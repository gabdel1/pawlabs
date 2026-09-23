/**
 * Structural variation for comparison articles.
 *
 * Every comparison on the site was built from one skeleton — Grooming, Energy,
 * Shedding, Trainability, Child-Friendly, "How They Stack Up Day-to-Day", "The
 * Lifestyle Match", "Our Bottom Line" — and every head-to-head carried the same
 * "Which Is Right for You?" headline. Read one at a time that is fine. Read six
 * in a row, which is what a reviewer does, and the shape itself announces that
 * a machine produced them.
 *
 * Two editors writing the same comparison would not reach for the same eight
 * headings in the same order, so this module supplies several genuinely
 * different plans: a different way in, a different order of argument, a
 * different closing move, different wording for the verdict.
 *
 * The shape is chosen from a hash of the breed slugs, so it is deterministic —
 * regenerating an article gives the same structure — while neighbouring
 * articles land on different plans.
 */

export interface ComparisonShape {
  key: string
  /** How the article opens. The single biggest driver of "these feel different". */
  opening: string
  /** The argument order, described rather than dictated as literal headings. */
  plan: string[]
  /** What the closing section is called and how it behaves. */
  closing: string
  /** Title patterns for this shape. {A} and {B} are the first two breeds. */
  titlePatterns: string[]
}

export const COMPARISON_SHAPES: ComparisonShape[] = [
  {
    key: 'decision-first',
    opening:
      'Open by answering the question outright in the first two sentences — name which breed suits most readers and why — then spend the article testing that claim and setting out who the exception is.',
    plan: [
      'The short answer, stated plainly, with the one fact that drives it',
      'The single biggest practical difference between them, in daily terms',
      'Where the two are genuinely interchangeable, so the reader stops agonising over it',
      'The situation that flips the recommendation to the other breed',
      'Cost, time and mess over a year of ownership',
    ],
    closing:
      'Close with a section that hands the reader a decision rule they could act on this week.',
    titlePatterns: ['{A} or {B}? The Honest Answer', '{A} vs {B}: Which One Should You Actually Get'],
  },
  {
    key: 'day-in-the-life',
    opening:
      'Open inside a specific ordinary day — 6am, the walk, the hours alone, the evening — and let the differences emerge from what actually happens in it. No summary paragraph before it.',
    plan: [
      'Morning: exercise needs and what happens if they go unmet',
      'The working day: tolerance of being alone, noise, and what the neighbours hear',
      'Evening and weekends: energy left over, sociability, what the dog demands of you',
      'The weekly and monthly admin: grooming, shedding, vet bills',
      'Which household each dog is quietly hoping for',
    ],
    closing: 'Close on the reader whose life suits neither, and say what would suit them instead.',
    titlePatterns: ['Living With a {A} vs a {B}', '{A} vs {B}: What Each Is Like to Live With'],
  },
  {
    key: 'myth-busting',
    opening:
      'Open with the assumption most people bring to this comparison and say straight away whether it holds up.',
    plan: [
      'The reputation each breed carries, and where it is wrong',
      'What the trait ratings actually show once you look',
      'The difference that matters more than the one people ask about',
      'Who each breed is genuinely unsuitable for — be specific and unflattering',
      'The training and socialisation each needs to become the dog people imagine',
    ],
    closing: 'Close by naming the mistake a first-time owner makes with each of these breeds.',
    titlePatterns: ['{A} vs {B}: What Most Buyers Get Wrong', 'The Real Difference Between a {A} and a {B}'],
  },
  {
    key: 'buyer-checklist',
    opening:
      'Open with the three questions a reader must answer about their own life before this comparison can be settled.',
    plan: [
      'Space and setting: what each breed needs from a home',
      'Hours: how much of your day each one requires, honestly counted',
      'Household: children, other pets, visitors, noise tolerance',
      'Upkeep: coat, shedding, health risks worth budgeting for',
      'Temperament under pressure: what each does when bored, startled or left alone',
    ],
    closing:
      'Close with a short scored summary: for each of the three opening questions, which breed wins and by how much.',
    titlePatterns: ['{A} vs {B}: A Buyer’s Checklist', 'Choosing Between a {A} and a {B}'],
  },
  {
    key: 'origins-to-sofa',
    opening:
      'Open with what each breed was originally built to do, and make the case that this still explains most of its behaviour on a sofa in 2026.',
    plan: [
      'What each was bred for, and which instincts survived',
      'How that shows up in the modern home, concretely',
      'Where the working history makes one breed harder than people expect',
      'Trainability and intelligence, and why those are not the same thing',
      'The owner each breed was, in effect, designed for',
    ],
    closing: 'Close by matching each breed to the kind of owner its history points at.',
    titlePatterns: ['{A} vs {B}: Two Very Different Jobs', 'Why a {A} Behaves Nothing Like a {B}'],
  },
  {
    key: 'cost-of-ownership',
    opening:
      'Open with what each breed asks of you that is not money — time, patience, tolerance for mess — and be blunt about it.',
    plan: [
      'The time cost: exercise, training, grooming, per week',
      'The mess cost: shedding, drool, destruction when under-stimulated',
      'The money cost: grooming, food volume, insurance and known health risks',
      'The social cost: barking, strangers, other dogs, holidays and dog-sitters',
      'What you get back, for each breed, and whether it is worth the above',
    ],
    closing: 'Close with the reader who should walk away from both, and what to consider instead.',
    titlePatterns: ['{A} vs {B}: What Each One Costs You', '{A} vs {B}: The Honest Trade-offs'],
  },
]

/**
 * Phrases that turned every article into the same article. Banned outright.
 *
 * "Our Bottom Line" and "How They Stack Up Day-to-Day" appeared as headings on
 * all 65 published comparisons — a literal signature of the template.
 */
export const BANNED_PHRASES = [
  'Our Bottom Line',
  'How They Stack Up Day-to-Day',
  'The Lifestyle Match',
  'Ratings show',
  'When it comes to',
  'In terms of',
  'game-changer',
  'perfect companion',
  'loving nature',
  'make a great addition',
  'furry friend',
  'At the end of the day',
]

/** Stable hash, so the same breeds always produce the same shape. */
function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function shapeFor(breedSlugs: string[]): ComparisonShape {
  const seed = hash([...breedSlugs].sort().join('|'))
  return COMPARISON_SHAPES[seed % COMPARISON_SHAPES.length]
}

/** The title pattern for this article, filled with the breed names. */
export function titleHintFor(shape: ComparisonShape, names: string[], slugs: string[]): string {
  const seed = hash([...slugs].sort().join('|'))
  const pattern = shape.titlePatterns[seed % shape.titlePatterns.length]
  return pattern.replace('{A}', names[0] ?? '').replace('{B}', names[1] ?? '')
}
