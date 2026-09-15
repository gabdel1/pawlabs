/**
 * Picks which two breeds to compare next.
 *
 * The naive version — two random breeds — produces articles nobody searches
 * for. "Chihuahua vs Great Dane" is not a decision anyone is actually weighing.
 * A comparison earns its traffic when the two breeds are genuinely
 * cross-shopped: same group, same size bracket, or names people mix up.
 *
 * So we score every pair that has not been written yet on four things:
 *
 *   1. Relevance   — would someone realistically choose between these two?
 *   2. Decisiveness — do they differ enough for the article to reach a verdict?
 *   3. Popularity  — featured breeds first.
 *   4. Coverage    — breeds not yet in any comparison get a nudge, so the
 *                    section spreads out instead of orbiting the same ten dogs.
 */

export interface PairBreed {
  id: string
  name: string
  slug: string
  petType?: string
  breedGroup?: string
  size?: string
  featured?: boolean
  weightMin?: number
  weightMax?: number
  traits?: Record<string, number>
}

export interface PairPick {
  a: PairBreed
  b: PairBreed
  score: number
  /** Human-readable justification, surfaced in the API response and logs. */
  reason: string
}

/**
 * Name tokens that signal two breeds get confused for each other. A shared one
 * is the strongest signal we have that a head-to-head is worth writing.
 */
const FAMILY_TOKENS = [
  'retriever', 'terrier', 'shepherd', 'spaniel', 'bulldog', 'poodle',
  'setter', 'hound', 'collie', 'mastiff', 'corgi', 'schnauzer',
  'pointer', 'sheepdog', 'pinscher', 'dane', 'husky', 'malamute',
  'ridgeback', 'water', 'griffon', 'coonhound', 'sennenhund', 'spitz',
]

const SIZE_ORDER = ['small', 'medium', 'large', 'giant']

/** Same inverted mapping the comparison table uses — higher is always better. */
const CRITERIA_FOR_SPREAD = [
  'energyLevel', 'trainability', 'childFriendly', 'petFriendly',
  'sheddingLevel', 'groomingNeeds', 'barkingLevel', 'adaptability',
  'watchdogAbility', 'healthRobustness', 'intelligence', 'affectionLevel',
]

function tokensOf(name: string): Set<string> {
  return new Set(
    name.toLowerCase().split(/[^a-z]+/).filter((t) => FAMILY_TOKENS.includes(t)),
  )
}

function sharedFamilyToken(a: PairBreed, b: PairBreed): string | null {
  const ta = tokensOf(a.name)
  for (const t of tokensOf(b.name)) if (ta.has(t)) return t
  return null
}

function weightsOverlap(a: PairBreed, b: PairBreed): boolean {
  if (!a.weightMin || !a.weightMax || !b.weightMin || !b.weightMax) return false
  return a.weightMin <= b.weightMax && b.weightMin <= a.weightMax
}

/** How many traits these two differ on by 3+ points — a proxy for "has a verdict". */
function decisiveness(a: PairBreed, b: PairBreed): number {
  let count = 0
  for (const key of CRITERIA_FOR_SPREAD) {
    const va = a.traits?.[key]
    const vb = b.traits?.[key]
    if (typeof va === 'number' && typeof vb === 'number' && Math.abs(va - vb) >= 3) count++
  }
  return count
}

export function pairKey(aId: string | number, bId: string | number): string {
  return [String(aId), String(bId)].sort().join('|')
}

/**
 * Score one candidate pair. Returns null when the pair should never be written
 * (different species, or already covered).
 */
function scorePair(
  a: PairBreed,
  b: PairBreed,
  alreadyCompared: Set<string>,
  appearances: Map<string, number>,
): PairPick | null {
  if (alreadyCompared.has(pairKey(a.id, b.id))) return null
  // Cross-species comparisons are a different article entirely.
  if (a.petType && b.petType && a.petType !== b.petType) return null

  const why: string[] = []
  let score = 0

  const token = sharedFamilyToken(a, b)
  if (token) {
    score += 6
    why.push(`both are ${token}s, which people routinely confuse`)
  }

  if (a.breedGroup && a.breedGroup === b.breedGroup) {
    score += 3
    why.push(`same breed group (${a.breedGroup})`)
  }

  if (a.size && a.size === b.size) {
    score += 2
    why.push(`both ${a.size}`)
  } else if (a.size && b.size) {
    // Adjacent size bands are still a plausible choice; two bands apart is not.
    const gap = Math.abs(SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size))
    if (gap === 1) score += 1
    else if (gap >= 2) score -= 4
  }

  if (weightsOverlap(a, b)) {
    score += 2
    why.push('overlapping weight ranges')
  }

  const spread = decisiveness(a, b)
  score += spread
  if (spread >= 5) why.push(`they differ sharply on ${spread} traits`)
  else if (spread <= 1) why.push('very similar temperaments')

  if (a.featured) score += 2
  if (b.featured) score += 2
  if (a.featured && b.featured) why.push('both featured breeds')

  // Spread coverage: each existing appearance makes a breed slightly less urgent.
  score -= (appearances.get(String(a.id)) ?? 0) * 2
  score -= (appearances.get(String(b.id)) ?? 0) * 2

  return {
    a,
    b,
    score,
    reason: why.length ? why.join('; ') : 'best remaining pairing by trait spread',
  }
}

/**
 * Rank every uncompared pair. Returns the strongest first.
 *
 * With ~200 breeds this is ~20k comparisons of cheap arithmetic — a few
 * milliseconds, so there is no need to be clever about the search itself.
 */
export function rankPairs(
  breeds: PairBreed[],
  comparedPairs: Set<string>,
  appearances: Map<string, number>,
  limit = 10,
): PairPick[] {
  const picks: PairPick[] = []

  for (let i = 0; i < breeds.length; i++) {
    for (let j = i + 1; j < breeds.length; j++) {
      const pick = scorePair(breeds[i], breeds[j], comparedPairs, appearances)
      if (pick) picks.push(pick)
    }
  }

  picks.sort(
    (x, y) => y.score - x.score || `${x.a.name}${x.b.name}`.localeCompare(`${y.a.name}${y.b.name}`),
  )
  return picks.slice(0, limit)
}
