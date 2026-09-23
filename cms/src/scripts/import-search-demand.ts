/**
 * Turn a Search Console query export into data/search-demand.json.
 *
 *   cd /srv/pet/cms && npx tsx src/scripts/import-search-demand.ts ~/queries.csv
 *
 * Search Console exports a CSV of "Top queries" with impressions and clicks.
 * Queries mentioning a breed are attributed to it, impressions are summed, and
 * the result is scaled 0-100 against the best-performing breed.
 *
 * Until this is run, the file holds a hand-written seed list: an informed guess
 * at which breeds people search for. Real numbers beat the guess as soon as
 * there is enough history to be worth trusting — a few hundred impressions
 * spread over a handful of breeds is not.
 */

import fs from 'node:fs'
import path from 'node:path'

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('usage: tsx src/scripts/import-search-demand.ts <search-console-queries.csv>')
  process.exit(1)
}

const OUT = path.resolve(process.cwd(), '../data/search-demand.json')
const API = process.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api'

/** Split a CSV line, honouring quoted fields. */
function splitCsv(line: string): string[] {
  const out: string[] = []
  let cur = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ } else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) { out.push(cur); cur = '' } else cur += c
  }
  out.push(cur)
  return out
}

const breeds: { slug: string; name: string }[] = (
  await (await fetch(`${API}/breeds?where[status][equals]=published&limit=300&depth=0`)).json()
).docs.map((d: any) => ({ slug: d.slug, name: d.name }))

const lines = fs.readFileSync(csvPath, 'utf-8').split(/\r?\n/).filter(Boolean)
const header = splitCsv(lines[0]).map((h) => h.trim().toLowerCase())
const qi = header.findIndex((h) => h.includes('quer'))
const ii = header.findIndex((h) => h.includes('impression'))
if (qi < 0 || ii < 0) {
  console.error(`could not find query and impression columns in: ${header.join(', ')}`)
  process.exit(1)
}

const totals = new Map<string, number>()
let matched = 0, unmatched = 0
for (const line of lines.slice(1)) {
  const cells = splitCsv(line)
  const query = (cells[qi] ?? '').toLowerCase()
  const impressions = Number((cells[ii] ?? '0').replace(/[^0-9.]/g, '')) || 0
  if (!query) continue

  // Longest breed name first, so "german shorthaired pointer" wins over "pointer".
  const hit = [...breeds]
    .sort((a, b) => b.name.length - a.name.length)
    .find((b) => query.includes(b.name.toLowerCase()))
  if (hit) {
    totals.set(hit.slug, (totals.get(hit.slug) ?? 0) + impressions)
    matched++
  } else unmatched++
}

const max = Math.max(...totals.values(), 1)
const scores = Object.fromEntries(
  [...totals.entries()]
    .map(([slug, n]) => [slug, Math.max(1, Math.round((n / max) * 100))] as const)
    .sort((a, b) => a[0].localeCompare(b[0])),
)

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      version: 1,
      updated: new Date().toISOString().slice(0, 10),
      source: `search-console:${path.basename(csvPath)}`,
      note: 'Generated from a Search Console query export. Scores are impressions scaled 0-100 against the best-performing breed.',
      default: 8,
      breeds: scores,
    },
    null,
    2,
  ) + '\n',
)

console.log(`matched ${matched} queries to ${Object.keys(scores).length} breeds (${unmatched} queries mentioned no breed)`)
console.log(`wrote ${OUT}`)
console.log('top:', [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s, n]) => `${s}(${n})`).join(', '))
console.log('\nRebuild the CMS and re-run scripts/compute-noindex.ts so both sides pick it up.')
