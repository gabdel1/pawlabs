/**
 * How much to feed a dog, in calories and then in cups.
 *
 * The standard veterinary approach, in two steps:
 *
 *   RER (resting energy requirement) = 70 × (body weight in kg)^0.75
 *   MER (maintenance energy requirement) = RER × a factor for life stage,
 *   neuter status and activity
 *
 * The exponent matters: energy needs do not scale linearly with weight, which
 * is why a 100 lb dog does not eat five times what a 20 lb dog eats.
 *
 * These are starting points. Published factors span a wide range because real
 * dogs vary by up to 50% around them, so the honest instruction — and the one
 * the page leads with — is to start here, then adjust against body condition
 * over a few weeks.
 */

export interface ActivityProfile {
  key: string;
  label: string;
  /** Multiplier applied to RER. */
  factor: number;
  description: string;
  /** Shown when this profile needs a caveat. */
  warning?: string;
}

/**
 * Life-stage and activity factors. Where sources give a range, the middle is
 * used and the range is shown on the page.
 */
export const PROFILES: ActivityProfile[] = [
  {
    key: 'puppy-young',
    label: 'Puppy, under 4 months',
    factor: 3.0,
    description: 'Growing fast. Usually fed three or four times a day.',
  },
  {
    key: 'puppy-older',
    label: 'Puppy, 4 months to adult',
    factor: 2.0,
    description: 'Growth is slowing. Most drop to twice a day around here.',
  },
  {
    key: 'neutered',
    label: 'Adult, neutered or spayed',
    factor: 1.6,
    description: 'The commonest case. Neutering lowers energy needs, which is why dogs often gain weight after it.',
  },
  {
    key: 'intact',
    label: 'Adult, not neutered',
    factor: 1.8,
    description: 'Slightly higher maintenance needs than a neutered dog of the same weight.',
  },
  {
    key: 'active',
    label: 'Active or working',
    factor: 2.5,
    description: 'Hours of real work or exercise daily — herding, gundog work, canicross, not a long walk.',
    warning: 'Genuine working dogs can need two to five times their resting requirement. If your dog works hard in cold weather, this may still be low.',
  },
  {
    key: 'inactive',
    label: 'Inactive or prone to weight gain',
    factor: 1.3,
    description: 'Short walks, a lot of sofa, or a dog that gains weight easily.',
  },
  {
    key: 'weight-loss',
    label: 'Needs to lose weight',
    factor: 1.0,
    description: 'Calculated from target weight, not current weight.',
    warning: 'Weight loss should be supervised by a vet. Crash dieting a dog is dangerous, and rapid weight loss in cats especially can be fatal. Aim for 1–2% of body weight per week.',
  },
  {
    key: 'senior',
    label: 'Senior, less active',
    factor: 1.4,
    description: 'Older dogs usually need less, though some need more if they are losing condition.',
  },
  {
    key: 'pregnant',
    label: 'Pregnant, last three weeks',
    factor: 1.8,
    description: 'Needs climb steeply in late pregnancy.',
    warning: 'Pregnancy and nursing needs change week to week — nursing mothers can need four to six times their resting requirement. Work with your vet rather than a calculator.',
  },
  {
    key: 'nursing',
    label: 'Nursing a litter',
    factor: 3.5,
    description: 'The highest demand any healthy dog has. Varies enormously with litter size.',
    warning: 'This is a rough midpoint of a very wide range (2–6× RER depending on litter size and week). Nursing mothers are usually fed free-choice. Ask your vet.',
  },
];

export function profileFor(key: string): ActivityProfile {
  return PROFILES.find((p) => p.key === key) ?? PROFILES[2];
}

export const LB_PER_KG = 2.20462;

export interface CalorieResult {
  /** Resting energy requirement, kcal/day. */
  rer: number;
  /** Maintenance energy requirement, kcal/day — what to feed. */
  mer: number;
  /** A sensible range around the estimate, kcal/day. */
  range: [number, number];
  /** Cups per day at the given food density, if one was supplied. */
  cupsPerDay: number | null;
  /** Grams per day, if a density was supplied. */
  gramsPerDay: number | null;
  /** Suggested meals a day for this life stage. */
  mealsPerDay: number;
  /** Amount per meal, in cups. */
  cupsPerMeal: number | null;
  warning?: string;
}

/**
 * @param weightLb   body weight (target weight for the weight-loss profile)
 * @param profileKey which activity/life-stage factor to use
 * @param kcalPerCup calories per cup from the food's label, if known
 */
export function dailyCalories(weightLb: number, profileKey: string, kcalPerCup?: number | null): CalorieResult {
  const profile = profileFor(profileKey);
  const kg = Math.max(0.5, weightLb) / LB_PER_KG;
  const rer = 70 * Math.pow(kg, 0.75);
  const mer = rer * profile.factor;

  // Real requirements scatter widely around the formula; showing a point
  // estimate alone invites people to treat it as precise.
  const range: [number, number] = [Math.round(mer * 0.85), Math.round(mer * 1.15)];

  const mealsPerDay = profileKey === 'puppy-young' ? 4 : profileKey === 'puppy-older' ? 3 : 2;
  const cupsPerDay = kcalPerCup && kcalPerCup > 0 ? mer / kcalPerCup : null;

  return {
    rer: Math.round(rer),
    mer: Math.round(mer),
    range,
    cupsPerDay: cupsPerDay ? Math.round(cupsPerDay * 100) / 100 : null,
    // A cup of dry dog food is roughly 110 g; useful for anyone weighing food,
    // which is more accurate than scooping.
    gramsPerDay: cupsPerDay ? Math.round(cupsPerDay * 110) : null,
    mealsPerDay,
    cupsPerMeal: cupsPerDay ? Math.round((cupsPerDay / mealsPerDay) * 100) / 100 : null,
    warning: profile.warning,
  };
}

/** Body condition scoring, the check that matters more than the number. */
export const BODY_CONDITION = [
  { score: '1–3', label: 'Too thin', note: 'Ribs, spine and hip bones visible from a distance. No fat cover. Increase food and see a vet.' },
  { score: '4–5', label: 'Ideal', note: 'Ribs easily felt under a thin fat cover, waist visible from above, belly tucked up from the side.' },
  { score: '6–7', label: 'Overweight', note: 'Ribs hard to feel, waist barely visible, fat over the spine and tail base. Reduce by 10% and reassess in a month.' },
  { score: '8–9', label: 'Obese', note: 'Ribs not palpable, obvious fat deposits, no waist. Needs a vet-supervised plan, not a crash diet.' },
];
