/**
 * Builds a year of article ideas.
 *
 * Walks forward one day at a time, drawing a style from the weighted pool and
 * filling it with the best unused subject for that style. Everything it picks
 * is recorded so the same pair, angle or group is never planned twice.
 *
 * The draw is seeded, so rebuilding a plan with the same seed gives the same
 * year — which makes it possible to preview a plan, tweak the weights, and
 * regenerate deterministically.
 */

import {
  ANGLES,
  STYLES,
  drawStyle,
  scoreForAngle,
  seededRandom,
  type Angle,
  type ArticleStyle,
} from './content-styles'
import { pairKey, rankPairs, type PairBreed } from './comparison-pairs'
import { demandFor, demandForSet, eligibleForPairing, MIN_PAIRING_DEMAND } from './search-demand'

export interface PlannedItem {
  workingTitle: string
  style: ArticleStyle
  angleKey?: string
  breedGroup?: string
  /** Pre-picked breed ids. Roundups leave this empty and shortlist at write time. */
  breedIds: string[]
  score: number
  reason: string
  scheduledFor: string
}

/**
 * How many pairing articles (head-to-head or three-way) one breed may appear in
 * across the whole plan.
 *
 * Without a cap the ranking keeps choosing the same well-connected dog: the
 * Airedale Terrier ended up as the third breed in six separate articles, and
 * the American Eskimo Dog in three. Each article was defensible alone; together
 * they are a visible generation pattern, and the clearest possible signal of
 * scaled content. Two is enough for a breed to be covered without the set
 * looking machine-made.
 */
export const MAX_PAIRING_APPEARANCES = 2

export interface PlanInput {
  breeds: PairBreed[]
  /** Pairs already written, so we never plan a duplicate. */
  comparedPairs: Set<string>
  /** How many comparisons each breed already appears in. */
  appearances: Map<string, number>
  /** Angles already used or planned. */
  usedAngles: Set<string>
  /** Breed groups already covered. */
  usedGroups: Set<string>
  days: number
  startDate: Date
  seed: number
}

function titleCase(value: string): string {
  return value.replace(/(^|[\s-])([a-z])/g, (_m, p, c) => p + c.toUpperCase())
}

/** Pick the best-fitting breeds for an angle, spreading across size bands. */
function shortlistForAngle(breeds: PairBreed[], angle: Angle, count: number): PairBreed[] {
  return breeds
    .map((b) => ({ b, s: scoreForAngle(b.traits, b.size, angle) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, count)
    .map((x) => x.b)
}

export function buildPlan(input: PlanInput): PlannedItem[] {
  const rand = seededRandom(input.seed)
  const items: PlannedItem[] = []

  // Local copies so planning does not mutate the caller's state.
  const compared = new Set(input.comparedPairs)
  const appearances = new Map(input.appearances)
  const groupCounts = new Map<string, PairBreed[]>()
  for (const b of input.breeds) {
    if (!b.breedGroup) continue
    if (!groupCounts.has(b.breedGroup)) groupCounts.set(b.breedGroup, [])
    groupCounts.get(b.breedGroup)!.push(b)
  }
  const viableGroups = [...groupCounts.entries()]
    .filter(([, list]) => list.length >= 5)
    .map(([g]) => g)

  const groupsLeft = viableGroups.filter((g) => !input.usedGroups.has(g))

  /**
   * Roundup subjects, broadest first.
   *
   * There are only ~25 lifestyle angles, which on its own leaves the year
   * dominated by head-to-heads. Crossing each angle with a breed group —
   * "Best terriers for apartments" — turns 25 subjects into a couple of
   * hundred, and those combinations are real searches in their own right.
   */
  type RoundupSubject = { angle: Angle; group?: string; key: string }
  const plainAngles: RoundupSubject[] = ANGLES.filter((a) => !input.usedAngles.has(a.key)).map(
    (angle) => ({ angle, key: angle.key }),
  )

  const combos: RoundupSubject[] = []
  for (const angle of ANGLES) {
    for (const group of viableGroups) {
      const key = `${angle.key}::${group}`
      if (input.usedAngles.has(key)) continue
      // Only worth writing if enough breeds in the group actually suit the angle.
      const fits = groupCounts
        .get(group)!
        .filter((b) => scoreForAngle(b.traits, b.size, angle) >= 55)
      if (fits.length >= 4) combos.push({ angle, group, key })
    }
  }
  // Shuffle combos so consecutive weeks are not all the same angle.
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[combos[i], combos[j]] = [combos[j], combos[i]]
  }

  const roundupsLeft: RoundupSubject[] = [...plainAngles, ...combos]

  const noteUsed = (ids: string[]) => {
    for (const id of ids) appearances.set(id, (appearances.get(id) ?? 0) + 1)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) compared.add(pairKey(ids[i], ids[j]))
    }
  }

  for (let day = 0; day < input.days; day++) {
    const date = new Date(input.startDate)
    date.setUTCDate(date.getUTCDate() + day)
    const scheduledFor = date.toISOString().slice(0, 10)

    // Try the drawn style first; fall back through the others if it is exhausted.
    const drawn = drawStyle(rand)
    const order = [drawn, ...STYLES.filter((s) => s.style !== drawn.style)]
    let placed: PlannedItem | null = null

    for (const styleDef of order) {
      if (placed) break

      if (styleDef.style === 'best-for') {
        const subject = roundupsLeft.shift()
        if (!subject) continue

        const pool = subject.group
          ? input.breeds.filter((b) => b.breedGroup === subject.group)
          : input.breeds
        if (shortlistForAngle(pool, subject.angle, 6).length < 4) continue

        placed = {
          workingTitle: subject.group
            ? `Best ${titleCase(subject.group)} Breeds for ${titleCase(subject.angle.label)}`
            : `Best Dogs for ${titleCase(subject.angle.label)}`,
          style: 'best-for',
          angleKey: subject.key,
          breedGroup: subject.group,
          breedIds: [],
          score: subject.group ? 85 : 100,
          reason: `Lifestyle roundup${subject.group ? ` within the ${subject.group} group` : ''}. ${subject.angle.intent} Shortlist is scored at write time so it tracks the latest ratings.`,
          scheduledFor,
        }
        break
      }

      if (styleDef.style === 'group-roundup') {
        const group = groupsLeft.shift()
        if (!group) continue
        const list = groupCounts.get(group)!
        placed = {
          workingTitle: `Every ${titleCase(group)} Breed, Ranked for Family Life`,
          style: 'group-roundup',
          breedGroup: group,
          breedIds: [],
          score: 90,
          reason: `Covers the ${group} group (${list.length} breeds profiled).`,
          scheduledFor,
        }
        break
      }

      // head-to-head and three-way both come from the pair ranking.
      const atCap = (id: string) => (appearances.get(String(id)) ?? 0) >= MAX_PAIRING_APPEARANCES
      const eligible = input.breeds.filter((b) => !atCap(b.id))
      const ranked = rankPairs(eligible, compared, appearances, 40)
      if (ranked.length === 0) continue
      const best = ranked[0]

      if (styleDef.style === 'three-way') {
        // Find a third breed that pairs well with both and is not yet used with
        // either. Best-searched candidate first: a three-way is a harder page to
        // rank than a head-to-head, so it needs more demand behind it, not less.
        const third = input.breeds
          .filter(
            (c) =>
              c.id !== best.a.id &&
              c.id !== best.b.id &&
              c.breedGroup === best.a.breedGroup &&
              !compared.has(pairKey(c.id, best.a.id)) &&
              !compared.has(pairKey(c.id, best.b.id)),
          )
          .filter((c) => !atCap(c.id) && eligibleForPairing(c.slug))
          .sort((x, y) => demandFor(y.slug) - demandFor(x.slug))
          .find((c) => demandForSet([best.a.slug, best.b.slug, c.slug]) >= MIN_PAIRING_DEMAND)
        if (third) {
          const ids = [best.a.id, best.b.id, third.id]
          noteUsed(ids)
          placed = {
            workingTitle: `${best.a.name} vs ${best.b.name} vs ${third.name}`,
            style: 'three-way',
            breedIds: ids,
            score: best.score,
            reason: `${best.reason}; ${third.name} shares the group and is commonly considered alongside them.`,
            scheduledFor,
          }
          break
        }
        continue
      }

      const ids = [best.a.id, best.b.id]
      noteUsed(ids)
      placed = {
        workingTitle: `${best.a.name} vs ${best.b.name}`,
        style: 'head-to-head',
        breedIds: ids,
        score: best.score,
        reason: best.reason,
        scheduledFor,
      }
    }

    if (!placed) break // every pool exhausted
    items.push(placed)
  }

  return items
}
