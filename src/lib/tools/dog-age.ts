/**
 * Dog age in human years, adjusted for size.
 *
 * The "multiply by seven" rule is wrong in both directions: it badly
 * underestimates the first two years, when a dog reaches full physical and
 * sexual maturity, and it ignores that a Great Dane is geriatric at eight
 * while a Chihuahua is middle-aged.
 *
 * The model here is the one veterinary bodies publish: roughly 15 human years
 * for the first year, about 9 more for the second, and a per-year rate after
 * that which rises with adult size. Large dogs age faster at every stage after
 * puberty — the reason a 10-year-old Great Dane and a 10-year-old Yorkshire
 * Terrier are not the same animal.
 *
 * It is a rule of thumb, not a measurement, and the page says so.
 */

export type SizeKey = 'small' | 'medium' | 'large' | 'giant';

export interface SizeBand {
  key: SizeKey;
  label: string;
  /** Adult weight range in pounds, for picking the right band. */
  weightRange: string;
  minLb: number;
  maxLb: number;
  /** Human years added per dog year after the second birthday. */
  yearlyRate: number;
  /** Typical lifespan, for the life-stage read-out. */
  typicalLifespan: [number, number];
}

export const SIZE_BANDS: SizeBand[] = [
  { key: 'small', label: 'Small', weightRange: 'up to 20 lb', minLb: 0, maxLb: 20, yearlyRate: 4, typicalLifespan: [12, 16] },
  { key: 'medium', label: 'Medium', weightRange: '21–50 lb', minLb: 21, maxLb: 50, yearlyRate: 5, typicalLifespan: [10, 14] },
  { key: 'large', label: 'Large', weightRange: '51–100 lb', minLb: 51, maxLb: 100, yearlyRate: 5.5, typicalLifespan: [8, 12] },
  { key: 'giant', label: 'Giant', weightRange: 'over 100 lb', minLb: 101, maxLb: 250, yearlyRate: 6.5, typicalLifespan: [6, 10] },
];

export function bandFor(key: SizeKey): SizeBand {
  return SIZE_BANDS.find((b) => b.key === key) ?? SIZE_BANDS[1];
}

/** Map a weight in pounds to its size band. */
export function bandForWeight(lb: number): SizeBand {
  return SIZE_BANDS.find((b) => lb >= b.minLb && lb <= b.maxLb) ?? SIZE_BANDS[SIZE_BANDS.length - 1];
}

export type LifeStage = 'puppy' | 'adolescent' | 'adult' | 'mature' | 'senior';

export interface AgeResult {
  /** Age in human years, rounded to a whole number. */
  humanYears: number;
  stage: LifeStage;
  stageLabel: string;
  /** What this stage means in practice. */
  stageNote: string;
  /** Roughly how far through a typical lifespan, 0-1. */
  lifeProgress: number;
}

const STAGE_NOTES: Record<LifeStage, string> = {
  puppy: 'Still growing. Vaccination schedule, socialisation window and rapid change month to month.',
  adolescent: 'Physically close to adult, mentally not. This is when training regressions and testing behaviour show up.',
  adult: 'Prime years. Steady weight, settled temperament, annual check-ups.',
  mature: 'Middle age. Worth watching weight, teeth and any stiffness after exercise.',
  senior: 'Senior. Twice-yearly check-ups are the usual advice, and changes in drinking, weight or sleep are worth reporting.',
};

const STAGE_LABELS: Record<LifeStage, string> = {
  puppy: 'Puppy',
  adolescent: 'Adolescent',
  adult: 'Adult',
  mature: 'Mature adult',
  senior: 'Senior',
};

/**
 * Life stage by dog years, shifted by size: a giant breed is senior years
 * before a small one, which is the whole point of doing this by size.
 */
function stageFor(dogYears: number, band: SizeBand): LifeStage {
  const seniorStart = band.typicalLifespan[0] * 0.6;
  const matureStart = seniorStart * 0.6;
  if (dogYears < 1) return 'puppy';
  if (dogYears < 2) return 'adolescent';
  if (dogYears < matureStart) return 'adult';
  if (dogYears < seniorStart) return 'mature';
  return 'senior';
}

/**
 * Convert a dog's age to human years.
 *
 * @param dogYears age in years; fractions are fine (0.5 = six months)
 */
export function dogAgeToHuman(dogYears: number, size: SizeKey): AgeResult {
  const band = bandFor(size);
  const age = Math.max(0, dogYears);

  let human: number;
  if (age <= 1) {
    human = age * 15;
  } else if (age <= 2) {
    human = 15 + (age - 1) * 9;
  } else {
    human = 24 + (age - 2) * band.yearlyRate;
  }

  const stage = stageFor(age, band);
  const avgLifespan = (band.typicalLifespan[0] + band.typicalLifespan[1]) / 2;

  return {
    humanYears: Math.round(human),
    stage,
    stageLabel: STAGE_LABELS[stage],
    stageNote: STAGE_NOTES[stage],
    lifeProgress: Math.min(1, age / avgLifespan),
  };
}

/**
 * The other way round: what dog age corresponds to a human age.
 * Used for the "you at their age" comparison on the page.
 */
export function humanAgeToDog(humanYears: number, size: SizeKey): number {
  const band = bandFor(size);
  if (humanYears <= 15) return Number((humanYears / 15).toFixed(1));
  if (humanYears <= 24) return Number((1 + (humanYears - 15) / 9).toFixed(1));
  return Number((2 + (humanYears - 24) / band.yearlyRate).toFixed(1));
}

/**
 * A year-by-year table for the page, so a reader can see the whole curve
 * rather than one number.
 */
export function ageTable(size: SizeKey, maxYears = 16): { dogYears: number; humanYears: number; stage: string }[] {
  const rows = [];
  for (let y = 1; y <= maxYears; y++) {
    const r = dogAgeToHuman(y, size);
    rows.push({ dogYears: y, humanYears: r.humanYears, stage: r.stageLabel });
  }
  return rows;
}
