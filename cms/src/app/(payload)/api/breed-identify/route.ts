import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import {
  BreedIdentifyError,
  identifyBreedFromPhoto,
  validateImageDataUrl,
  type BreedChoice,
} from '../../../../lib/grok-breed-identify'

/**
 * Public photo breed identifier. Called from /what-breed-is-my-dog.
 *
 * Unauthenticated, and every request costs a vision-model call, so it is
 * defended at three levels: a per-IP hourly limit, a site-wide daily ceiling
 * that caps the worst-case bill if someone spreads requests across many
 * addresses, and strict validation of the upload itself before any of that
 * money is spent.
 *
 * The photo is never stored. It is validated, sent to the model and dropped.
 * The log line records the outcome and cost — never the image, never the IP.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

/**
 * About half a cent per photo at current prices, so the default caps a bad
 * day at roughly $8. Raise it with BREED_ID_DAILY_CAP once real traffic shows
 * what normal looks like.
 */
const DAILY_CAP = Number(process.env.BREED_ID_DAILY_CAP) || 1500

/**
 * The browser resizes to 1024px JPEG before upload, which lands around
 * 100-350 KB. 1.5 MB leaves room for a PNG from a browser that skipped the
 * resize, without accepting something absurd.
 */
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024

const hits = new Map<string, number[]>()
let day = new Date().toISOString().slice(0, 10)
let dayCount = 0

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)

  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) hits.delete(key)
    }
  }
  return recent.length > RATE_LIMIT_MAX
}

/** Counts a request against today's ceiling; true when the ceiling is reached. */
function overDailyCap(): boolean {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== day) {
    day = today
    dayCount = 0
  }
  dayCount += 1
  return dayCount > DAILY_CAP
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

interface BreedCard {
  slug: string
  name: string
  imageUrl: string | null
  breedGroup: string | null
  size: string | null
  weightMin: number | null
  weightMax: number | null
  lifeExpectancyMin: number | null
  lifeExpectancyMax: number | null
  shortDescription: string | null
  traits: Record<string, number>
}

/**
 * The breed list barely changes, and reading 200 documents on every photo would
 * be wasteful. Five minutes keeps a newly published breed from waiting long.
 */
const BREED_CACHE_MS = 5 * 60 * 1000
let breedCache: { at: number; cards: Map<string, BreedCard>; choices: BreedChoice[] } | null = null

async function loadBreeds() {
  if (breedCache && Date.now() - breedCache.at < BREED_CACHE_MS) return breedCache

  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'breeds',
    where: { status: { equals: 'published' }, petType: { equals: 'dog' } },
    limit: 1000,
    depth: 1,
    pagination: false,
  })

  const cards = new Map<string, BreedCard>()
  for (const doc of docs as Record<string, any>[]) {
    const filename: string | undefined = doc.image?.filename
    cards.set(doc.slug, {
      slug: doc.slug,
      name: doc.name,
      // Same rule as the static site's getMediaUrl: encode, never trust the filename.
      imageUrl: filename ? `/media/${encodeURIComponent(filename)}` : null,
      breedGroup: doc.breedGroup ?? null,
      size: doc.size ?? null,
      weightMin: doc.weightMin ?? null,
      weightMax: doc.weightMax ?? null,
      lifeExpectancyMin: doc.lifeExpectancyMin ?? null,
      lifeExpectancyMax: doc.lifeExpectancyMax ?? null,
      shortDescription: doc.shortDescription ?? null,
      traits: Object.fromEntries(
        ['energyLevel', 'childFriendly', 'trainability', 'sheddingLevel', 'groomingNeeds']
          .filter((k) => typeof doc.traits?.[k] === 'number')
          .map((k) => [k, doc.traits[k]]),
      ),
    })
  }

  breedCache = {
    at: Date.now(),
    cards,
    choices: [...cards.values()].map((c) => ({ slug: c.slug, name: c.name })),
  }
  return breedCache
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS_HEADERS })

  try {
    if (rateLimited(clientIp(req))) {
      return json({ error: "You've checked quite a few photos already. Try again in an hour." }, 429)
    }

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ error: 'That upload did not come through properly. Please try again.' }, 400)
    }

    const image = validateImageDataUrl(body.image, MAX_IMAGE_BYTES)
    if (!image.ok) return json({ error: image.error }, 400)

    // Checked after validation, so junk requests do not use up the day's budget.
    if (overDailyCap()) {
      console.warn(`[breed-identify] daily cap of ${DAILY_CAP} reached`)
      return json({ error: 'The breed identifier is very busy today. Please try again tomorrow.' }, 503)
    }

    const { cards, choices } = await loadBreeds()
    const result = await identifyBreedFromPhoto({ imageDataUrl: image.dataUrl, breeds: choices })

    const top = result.matches[0]
    console.log(
      `[breed-identify] status=${result.status} top=${top ? `${top.slug}:${top.percent}` : '-'} ` +
        `n=${result.matches.length} mixed=${result.likelyMixed} conf=${result.confidence} ` +
        `ms=${result.latencyMs} tok=${result.usage ? `${result.usage.promptTokens}/${result.usage.completionTokens}` : '-'}`,
    )

    return json({
      status: result.status,
      confidence: result.confidence,
      likelyMixed: result.likelyMixed,
      summary: result.summary,
      visibleTraits: result.visibleTraits,
      matches: result.matches
        .map((m) => {
          const card = cards.get(m.slug)
          return card ? { ...card, percent: m.percent, evidence: m.evidence } : null
        })
        .filter(Boolean),
    })
  } catch (e) {
    const err = e as Error
    console.error('[breed-identify] failed:', err.message)
    const message =
      err instanceof BreedIdentifyError
        ? err.publicMessage
        : 'Something went wrong reading that photo. Please try again.'
    return json({ error: message }, 502)
  }
}
