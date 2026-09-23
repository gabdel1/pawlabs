/**
 * Search demand per breed, for the generator.
 *
 * Reads the same data/search-demand.json the site build reads, so the pages we
 * agree to write and the pages we agree to index are decided by one set of
 * numbers. The site's copy of this logic is src/lib/search-demand.ts; keep the
 * thresholds in step if you change them.
 *
 * Why it exists: 201 breeds make 20,100 possible head-to-heads and almost none
 * of them are searched for. Without a demand floor the planner will happily
 * spend a year writing "Sealyham Terrier vs Glen of Imaal Terrier".
 */

import fs from 'node:fs'
import path from 'node:path'

interface DemandFile {
  default: number
  source: string
  updated: string
  breeds: Record<string, number>
}

const CANDIDATE_PATHS = [
  path.resolve(process.cwd(), '../data/search-demand.json'),
  path.resolve(process.cwd(), 'data/search-demand.json'),
]

let cached: DemandFile | null = null

function load(): DemandFile {
  if (cached) return cached
  for (const file of CANDIDATE_PATHS) {
    try {
      if (fs.existsSync(file)) {
        cached = JSON.parse(fs.readFileSync(file, 'utf-8')) as DemandFile
        return cached
      }
    } catch (e) {
      console.warn(`[search-demand] could not read ${file}:`, e)
    }
  }
  // Without data, gate nothing rather than block all generation.
  console.warn('[search-demand] data/search-demand.json not found — no demand gating')
  cached = { default: 100, source: 'missing', updated: '', breeds: {} }
  return cached
}

/** 0-100 relative search interest for one breed. */
export function demandFor(slug: string): number {
  const data = load()
  return data.breeds[slug] ?? data.default
}

/** Weighted towards the strongest breed: a known breed carries an unknown one. */
export function demandForSet(slugs: string[]): number {
  if (!slugs.length) return 0
  const scores = slugs.map(demandFor)
  const max = Math.max(...scores)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  return Math.round(max * 0.6 + mean * 0.4)
}

/** Must match MIN_PAIRING_DEMAND in src/lib/search-demand.ts. */
export const MIN_PAIRING_DEMAND = 40

/**
 * Every breed in a new pairing must clear this on its own.
 *
 * The combined score alone is not enough: it let one well-known breed drag two
 * obscure ones into an article, which is how six "X vs Y vs Airedale Terrier"
 * pages came to exist. A pairing is only worth writing when a reader might
 * plausibly be weighing up both animals.
 */
export const MIN_BREED_DEMAND_IN_PAIRING = 45

/** True when this breed is searched for enough to appear in a new pairing. */
export function eligibleForPairing(slug: string): boolean {
  return demandFor(slug) >= MIN_BREED_DEMAND_IN_PAIRING
}

export function demandSource(): string {
  const data = load()
  return `${data.source} (${Object.keys(data.breeds).length} breeds, updated ${data.updated || 'never'})`
}
