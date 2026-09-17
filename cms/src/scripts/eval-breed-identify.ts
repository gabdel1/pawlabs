/**
 * Benchmark photo breed identification against our own labelled breed photos.
 *
 *   cd /srv/pet/cms && npx tsx src/scripts/eval-breed-identify.ts [--models=a,b] [--n=40]
 *
 * Each breed profile's image is a photo whose breed we already know, which
 * makes it a free test set. Every image is resized to 1024px JPEG first — the
 * same thing the browser does before upload — so the model sees what a real
 * request would send.
 *
 * Read the numbers as a ceiling, not a forecast. Profile images are clean,
 * well-lit, side-on portraits of typical examples of each breed. A visitor's
 * phone photo of a muddy rescue mix is much harder, and there is no labelled
 * set of those to measure against.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(dirname, '../../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
}

const { identifyBreedFromPhoto } = await import('../lib/grok-breed-identify')

const API = process.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api'
const MEDIA_DIR = path.resolve(dirname, '../../../public/media')

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const models = (arg('models') ?? 'grok-4.3').split(',')
const sampleSize = Number(arg('n') ?? 40)
const CONCURRENCY = 4

async function toJpegDataUrl(input: string | Buffer): Promise<string> {
  const buf = await sharp(input)
    .rotate()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 85 })
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

const breedsRes = await fetch(`${API}/breeds?where[status][equals]=published&limit=300&depth=1&sort=name`)
const breeds: any[] = (await breedsRes.json()).docs
const choices = breeds.map((b) => ({ slug: b.slug, name: b.name }))

// Live prices, so the cost column is not a guess. xAI quotes them in units of
// 1/10,000 of a dollar per million tokens.
const priceRes = await fetch('https://api.x.ai/v1/language-models', {
  headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
})
const prices = new Map<string, { input: number; output: number }>()
for (const m of (await priceRes.json()).models ?? []) {
  prices.set(m.id, {
    input: (m.prompt_image_token_price ?? m.prompt_text_token_price ?? 0) / 10000 / 1e6,
    output: (m.completion_text_token_price ?? 0) / 10000 / 1e6,
  })
}

const labelled = breeds.filter((b) => b.image?.filename && fs.existsSync(path.join(MEDIA_DIR, b.image.filename)))
// Evenly spaced through the alphabet, so the sample is stable between runs.
const step = Math.max(1, Math.floor(labelled.length / sampleSize))
const sample = labelled.filter((_, i) => i % step === 0).slice(0, sampleSize)

// Negative cases: things that are not a photo of a dog.
const negatives = [
  { label: 'site logo', input: path.resolve(dirname, '../../../public/android-chrome-512x512.png') },
  {
    label: 'plain gradient',
    input: await sharp({
      create: { width: 900, height: 700, channels: 3, background: { r: 120, g: 160, b: 200 } },
    })
      .composite([{ input: Buffer.from('<svg width="900" height="700"><rect x="200" y="150" width="500" height="400" rx="60" fill="#e8d5b0"/></svg>') }])
      .png()
      .toBuffer(),
  },
]

console.log(`\n${labelled.length} labelled photos available, testing ${sample.length} + ${negatives.length} negatives\n`)

for (const model of models) {
  const started = Date.now()
  const rows = await pool(sample, CONCURRENCY, async (breed) => {
    try {
      const dataUrl = await toJpegDataUrl(path.join(MEDIA_DIR, breed.image.filename))
      const r = await identifyBreedFromPhoto({ imageDataUrl: dataUrl, breeds: choices, model })
      const slugs = r.matches.map((m) => m.slug)
      return { breed, r, top1: slugs[0] === breed.slug, top3: slugs.slice(0, 3).includes(breed.slug), error: null as string | null }
    } catch (e) {
      return { breed, r: null, top1: false, top3: false, error: (e as Error).message }
    }
  })

  const negRows = await pool(negatives, CONCURRENCY, async (neg) => {
    try {
      const r = await identifyBreedFromPhoto({ imageDataUrl: await toJpegDataUrl(neg.input), breeds: choices, model })
      return { neg, r, error: null as string | null }
    } catch (e) {
      return { neg, r: null, error: (e as Error).message }
    }
  })

  const ok = rows.filter((x) => x.r)
  const all = [...ok.map((x) => x.r!), ...negRows.filter((x) => x.r).map((x) => x.r!)]
  const price = prices.get(model)
  const cost = all.reduce(
    (sum, r) => sum + (r.usage && price ? r.usage.promptTokens * price.input + r.usage.completionTokens * price.output : 0),
    0,
  )
  const latencies = all.map((r) => r.latencyMs).sort((a, b) => a - b)
  const pct = (n: number) => `${((n / sample.length) * 100).toFixed(0)}%`

  console.log('='.repeat(78))
  console.log(`  ${model}`)
  console.log('='.repeat(78))
  console.log(`  top-1 correct     ${rows.filter((x) => x.top1).length}/${sample.length}  (${pct(rows.filter((x) => x.top1).length)})`)
  console.log(`  top-3 correct     ${rows.filter((x) => x.top3).length}/${sample.length}  (${pct(rows.filter((x) => x.top3).length)})`)
  console.log(`  errors            ${rows.filter((x) => x.error).length + negRows.filter((x) => x.error).length}`)
  console.log(`  latency           median ${latencies[Math.floor(latencies.length / 2)]}ms   p90 ${latencies[Math.floor(latencies.length * 0.9)]}ms`)
  if (all[0]?.usage) {
    const avgIn = Math.round(all.reduce((s, r) => s + (r.usage?.promptTokens ?? 0), 0) / all.length)
    const avgOut = Math.round(all.reduce((s, r) => s + (r.usage?.completionTokens ?? 0), 0) / all.length)
    console.log(`  tokens / photo    ${avgIn} in, ${avgOut} out`)
  }
  console.log(`  cost / photo      $${(cost / all.length).toFixed(4)}   (1,000 photos ≈ $${((cost / all.length) * 1000).toFixed(2)})`)
  console.log(`  wall time         ${((Date.now() - started) / 1000).toFixed(0)}s`)
  console.log(`  status mix        ${JSON.stringify(ok.reduce((a: any, x) => ((a[x.r!.status] = (a[x.r!.status] ?? 0) + 1), a), {}))}`)

  console.log('\n  misses (expected -> got):')
  for (const x of rows.filter((x) => !x.top1)) {
    const got = x.r ? x.r.matches.map((m) => `${m.slug} ${m.percent}%`).join(', ') || `[${x.r.status}]` : `ERROR ${x.error}`
    console.log(`    ${x.breed.slug.padEnd(32)} -> ${got}`)
  }

  console.log('\n  negatives:')
  for (const x of negRows) {
    console.log(`    ${x.neg.label.padEnd(16)} -> ${x.r ? `${x.r.status} ${x.r.matches.map((m) => m.slug).join(',')}` : `ERROR ${x.error}`}`)
  }

  const example = ok.find((x) => x.top1)?.r
  if (example) {
    console.log('\n  example output:')
    console.log('   ', JSON.stringify({ ...example, usage: undefined }).slice(0, 700))
  }
  console.log()
}
