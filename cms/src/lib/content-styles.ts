/**
 * Article styles and audience angles for the content plan.
 *
 * A year of nothing but "X vs Y" would be monotonous and would miss the queries
 * that actually convert — people search "best dog for apartments" far more than
 * they search any specific pairing. So the planner draws from four pools:
 *
 *   head-to-head   two breeds, the classic comparison
 *   three-way      three breeds people cross-shop as a set
 *   best-for       a ranked roundup answering a lifestyle question
 *   group-roundup  every breed in one group, ranked for a purpose
 *
 * The `best-for` angles carry trait targets, so the breeds in a roundup are
 * chosen by the same objective scoring the quiz uses rather than by vibe.
 */

export type ArticleStyle = 'head-to-head' | 'three-way' | 'best-for' | 'group-roundup'

export interface StyleDef {
  style: ArticleStyle
  label: string
  /** Relative draw weight when the planner picks a style for a slot. */
  weight: number
  minBreeds: number
  maxBreeds: number
}

export const STYLES: StyleDef[] = [
  { style: 'best-for', label: 'Best breed for…', weight: 40, minBreeds: 5, maxBreeds: 8 },
  { style: 'head-to-head', label: 'Head to head', weight: 30, minBreeds: 2, maxBreeds: 2 },
  { style: 'three-way', label: 'Three-way', weight: 15, minBreeds: 3, maxBreeds: 3 },
  { style: 'group-roundup', label: 'Group roundup', weight: 15, minBreeds: 5, maxBreeds: 8 },
]

export interface TraitTarget {
  trait: string
  /** Ideal 1-10 score. */
  target: number
  /** How much it matters, 1-5. */
  weight: number
}

export interface Angle {
  key: string
  /** Used to build the article title. */
  label: string
  /** One line telling the writer who this reader is. */
  intent: string
  targets: TraitTarget[]
  /** Optional soft size preference. */
  prefersSizes?: string[]
}

const t = (trait: string, target: number, weight: number): TraitTarget => ({ trait, target, weight })

/**
 * Lifestyle angles for `best-for` roundups.
 *
 * Each is a real search intent, and each has trait targets so the shortlist is
 * defensible: "best apartment dogs" returns breeds that actually score low on
 * energy and barking and high on adaptability, not just small ones.
 */
export const ANGLES: Angle[] = [
  {
    key: 'apartments',
    label: 'apartment living',
    intent: 'Someone in a flat with no private outdoor space, likely with neighbours through the wall.',
    targets: [t('adaptability', 9, 5), t('barkingLevel', 2, 5), t('energyLevel', 3, 4)],
    prefersSizes: ['small', 'medium'],
  },
  {
    key: 'first-time-owners',
    label: 'first-time owners',
    intent: 'Has never owned a dog. Needs forgiving temperament and straightforward training.',
    targets: [t('trainability', 9, 5), t('adaptability', 8, 3), t('healthRobustness', 8, 3), t('energyLevel', 5, 2)],
  },
  {
    key: 'families-toddlers',
    label: 'families with toddlers',
    intent: 'Small children in the house. Tolerance and predictability matter more than anything else.',
    targets: [t('childFriendly', 10, 5), t('affectionLevel', 8, 3), t('playfulness', 7, 2)],
  },
  {
    key: 'allergy-sufferers',
    label: 'allergy sufferers',
    intent: 'Someone reacting to dander. Wants the lowest-shedding coats available.',
    targets: [t('sheddingLevel', 1, 5), t('groomingNeeds', 6, 1)],
  },
  {
    key: 'seniors',
    label: 'older owners',
    intent: 'A retired or less mobile owner who wants company without a physical challenge.',
    targets: [t('energyLevel', 3, 5), t('trainability', 8, 3), t('affectionLevel', 9, 3)],
    prefersSizes: ['small', 'medium'],
  },
  {
    key: 'runners',
    label: 'runners and hikers',
    intent: 'Wants a dog that can cover real distance and still want more.',
    targets: [t('energyLevel', 10, 5), t('healthRobustness', 8, 3), t('trainability', 7, 2)],
    prefersSizes: ['medium', 'large'],
  },
  {
    key: 'working-full-time',
    label: 'people who work full time',
    intent: 'Out of the house eight or nine hours. Needs a breed that copes with being alone.',
    targets: [t('adaptability', 9, 5), t('affectionLevel', 5, 3), t('energyLevel', 4, 3), t('barkingLevel', 3, 3)],
  },
  {
    key: 'guard-duty',
    label: 'home security',
    intent: 'Wants a dog that notices and announces strangers, and looks like it means it.',
    targets: [t('watchdogAbility', 10, 5), t('strangerFriendly', 3, 3), t('trainability', 8, 3)],
    prefersSizes: ['medium', 'large', 'giant'],
  },
  {
    key: 'low-maintenance-coat',
    label: 'low grooming',
    intent: 'Does not want a grooming routine or a monthly groomer bill.',
    targets: [t('groomingNeeds', 2, 5), t('sheddingLevel', 3, 3)],
  },
  {
    key: 'multi-pet-homes',
    label: 'homes with other pets',
    intent: 'Already has a cat or another dog. Needs a breed that integrates.',
    targets: [t('petFriendly', 10, 5), t('adaptability', 8, 3)],
  },
  {
    key: 'quiet-breeds',
    label: 'people who need quiet',
    intent: 'Thin walls, a newborn, or night shifts. Barking is the dealbreaker.',
    targets: [t('barkingLevel', 1, 5), t('adaptability', 8, 2)],
  },
  {
    key: 'small-homes',
    label: 'small houses and terraces',
    intent: 'Limited indoor space but some outdoor access.',
    targets: [t('adaptability', 8, 4), t('energyLevel', 4, 3)],
    prefersSizes: ['small', 'medium'],
  },
  {
    key: 'kids-and-dogs-active',
    label: 'active families',
    intent: 'Older children, weekends outdoors, wants a dog that keeps up with all of it.',
    targets: [t('childFriendly', 9, 4), t('energyLevel', 8, 4), t('playfulness', 9, 3)],
  },
  {
    key: 'trainability-sports',
    label: 'dog sports and training',
    intent: 'Wants agility, obedience or scent work. Biddability is the whole point.',
    targets: [t('trainability', 10, 5), t('intelligence', 10, 4), t('energyLevel', 8, 3)],
  },
  {
    key: 'cold-climates',
    label: 'cold climates',
    intent: 'Long winters. Needs a coat and a constitution for it.',
    targets: [t('healthRobustness', 8, 3), t('energyLevel', 7, 2), t('adaptability', 7, 2)],
    prefersSizes: ['medium', 'large', 'giant'],
  },
  {
    key: 'hot-climates',
    label: 'hot climates',
    intent: 'Long summers. Heat tolerance and a coat that does not cook the dog.',
    targets: [t('groomingNeeds', 3, 3), t('energyLevel', 5, 2), t('healthRobustness', 8, 3)],
  },
  {
    key: 'couch-companions',
    label: 'low-energy companions',
    intent: 'Wants company on the sofa, not a training project.',
    targets: [t('energyLevel', 2, 5), t('affectionLevel', 10, 4), t('playfulness', 4, 2)],
  },
  {
    key: 'anxious-owners',
    label: 'nervous or anxious owners',
    intent: 'Wants a steady, unflappable dog that will not add stress.',
    targets: [t('adaptability', 9, 4), t('trainability', 8, 3), t('barkingLevel', 3, 3), t('energyLevel', 4, 3)],
  },
  {
    key: 'healthiest',
    label: 'long-term health',
    intent: 'Wants the lowest likelihood of expensive chronic conditions.',
    targets: [t('healthRobustness', 10, 5)],
  },
  {
    key: 'kids-with-allergies',
    label: 'families with allergies',
    intent: 'Children in the house and someone reacting to dander.',
    targets: [t('sheddingLevel', 1, 5), t('childFriendly', 9, 4)],
  },
  {
    key: 'rural-smallholding',
    label: 'rural properties',
    intent: 'Land, livestock or an outdoor working life.',
    targets: [t('energyLevel', 9, 4), t('trainability', 8, 3), t('watchdogAbility', 8, 3), t('healthRobustness', 8, 2)],
    prefersSizes: ['medium', 'large', 'giant'],
  },
  {
    key: 'travel-companions',
    label: 'people who travel',
    intent: 'Wants a dog that copes with cars, hotels and new places.',
    targets: [t('adaptability', 10, 5), t('strangerFriendly', 8, 3), t('barkingLevel', 3, 3)],
    prefersSizes: ['small', 'medium'],
  },
  {
    key: 'therapy-work',
    label: 'therapy and assistance work',
    intent: 'Needs to be calm, biddable and reliable around strangers.',
    targets: [t('trainability', 10, 5), t('strangerFriendly', 9, 4), t('affectionLevel', 9, 3), t('barkingLevel', 3, 3)],
  },
  {
    key: 'busy-professionals',
    label: 'busy professionals',
    intent: 'Long hours, limited routine, still wants a dog.',
    targets: [t('adaptability', 9, 5), t('energyLevel', 3, 4), t('groomingNeeds', 3, 3)],
  },
  {
    key: 'kids-teenagers',
    label: 'households with teenagers',
    intent: 'Older kids who want to be involved in training and walking.',
    targets: [t('childFriendly', 8, 3), t('trainability', 8, 3), t('playfulness', 8, 3), t('energyLevel', 7, 2)],
  },
]

/** Weighted draw from the style pool. */
export function drawStyle(rand: () => number): StyleDef {
  const total = STYLES.reduce((sum, s) => sum + s.weight, 0)
  let roll = rand() * total
  for (const s of STYLES) {
    roll -= s.weight
    if (roll <= 0) return s
  }
  return STYLES[0]
}

/**
 * Deterministic PRNG so a plan built from the same seed is reproducible —
 * makes the planner testable and lets you regenerate an identical year.
 */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/** Score one breed against an angle. Higher is a better fit. 0-100. */
export function scoreForAngle(
  traits: Record<string, number> | undefined,
  size: string | undefined,
  angle: Angle,
): number {
  if (!traits) return 0
  let penalty = 0
  let max = 0

  for (const target of angle.targets) {
    const raw = traits[target.trait]
    const value = typeof raw === 'number' ? Math.max(1, Math.min(10, raw)) : 5
    penalty += Math.abs(value - target.target) * target.weight
    max += 9 * target.weight
  }

  let fit = max > 0 ? 1 - penalty / max : 0.5
  if (angle.prefersSizes?.length && size) {
    fit = fit * 0.9 + (angle.prefersSizes.includes(size) ? 0.1 : 0)
  }
  return Math.round(Math.max(0, Math.min(1, fit)) * 100)
}
