/**
 * Predicting a puppy's adult weight from what it weighs now.
 *
 * Puppies grow to a fairly predictable percentage of their adult weight by a
 * given age, and that percentage depends on how big they will end up: a toy
 * breed is nearly finished at nine months, a Great Dane is still filling out at
 * eighteen. So the method is to divide current weight by the fraction of adult
 * weight typical at that age for that size class.
 *
 * Accuracy is limited and the page says so plainly. Mixed-breed puppies of
 * unknown parentage are the weakest case, growth is not perfectly smooth, and
 * an individual can land well outside the range. Treat the output as a bracket
 * for buying a crate and a harness, not a promise.
 */

export type GrowthClass = 'toy' | 'small' | 'medium' | 'large' | 'giant';

export interface GrowthClassDef {
  key: GrowthClass;
  label: string;
  /** Adult weight range in pounds this class describes. */
  adultRange: [number, number];
  description: string;
  /** Age in weeks at which growth is essentially finished. */
  matureWeeks: number;
  /** age in weeks -> fraction of adult weight typically reached */
  curve: [weeks: number, fraction: number][];
}

/**
 * Growth curves by size class. Larger dogs reach a smaller fraction of their
 * adult weight at any given age, because they keep growing for far longer.
 */
export const GROWTH_CLASSES: GrowthClassDef[] = [
  {
    key: 'toy',
    label: 'Toy',
    adultRange: [2, 12],
    description: 'Chihuahua, Pomeranian, Yorkshire Terrier',
    matureWeeks: 40,
    curve: [[6, 0.22], [8, 0.31], [10, 0.4], [12, 0.5], [14, 0.58], [16, 0.66], [20, 0.78], [24, 0.87], [30, 0.95], [40, 1]],
  },
  {
    key: 'small',
    label: 'Small',
    adultRange: [13, 25],
    description: 'Beagle, French Bulldog, Cavalier King Charles Spaniel',
    matureWeeks: 48,
    curve: [[6, 0.2], [8, 0.28], [10, 0.36], [12, 0.46], [14, 0.54], [16, 0.62], [20, 0.74], [24, 0.83], [30, 0.92], [36, 0.97], [48, 1]],
  },
  {
    key: 'medium',
    label: 'Medium',
    adultRange: [26, 55],
    description: 'Border Collie, Cocker Spaniel, Australian Shepherd',
    matureWeeks: 52,
    curve: [[6, 0.17], [8, 0.24], [10, 0.32], [12, 0.41], [14, 0.49], [16, 0.57], [20, 0.68], [24, 0.77], [30, 0.87], [36, 0.93], [44, 0.98], [52, 1]],
  },
  {
    key: 'large',
    label: 'Large',
    adultRange: [56, 100],
    description: 'Labrador Retriever, German Shepherd, Golden Retriever',
    matureWeeks: 72,
    curve: [[6, 0.14], [8, 0.2], [10, 0.27], [12, 0.35], [14, 0.42], [16, 0.5], [20, 0.6], [24, 0.68], [30, 0.79], [36, 0.86], [44, 0.92], [52, 0.96], [62, 0.99], [72, 1]],
  },
  {
    key: 'giant',
    label: 'Giant',
    adultRange: [101, 200],
    description: 'Great Dane, Mastiff, Saint Bernard, Newfoundland',
    matureWeeks: 96,
    curve: [[6, 0.12], [8, 0.17], [10, 0.23], [12, 0.3], [14, 0.37], [16, 0.44], [20, 0.53], [24, 0.61], [30, 0.71], [36, 0.79], [44, 0.86], [52, 0.91], [62, 0.95], [72, 0.98], [96, 1]],
  },
];

export function growthClass(key: GrowthClass): GrowthClassDef {
  return GROWTH_CLASSES.find((c) => c.key === key) ?? GROWTH_CLASSES[2];
}

/** Pick the class an expected adult weight falls into. */
export function classForAdultWeight(lb: number): GrowthClassDef {
  return GROWTH_CLASSES.find((c) => lb >= c.adultRange[0] && lb <= c.adultRange[1]) ?? GROWTH_CLASSES[GROWTH_CLASSES.length - 1];
}

/** Linear interpolation along the growth curve. */
function fractionAt(def: GrowthClassDef, weeks: number): number {
  const curve = def.curve;
  if (weeks <= curve[0][0]) return curve[0][1] * (weeks / curve[0][0]);
  if (weeks >= def.matureWeeks) return 1;

  for (let i = 0; i < curve.length - 1; i++) {
    const [w1, f1] = curve[i];
    const [w2, f2] = curve[i + 1];
    if (weeks >= w1 && weeks <= w2) {
      const t = (weeks - w1) / (w2 - w1);
      return f1 + (f2 - f1) * t;
    }
  }
  return 1;
}

export interface WeightPrediction {
  /** Best estimate of adult weight, pounds. */
  adultLb: number;
  /** Plausible range, pounds. */
  rangeLb: [number, number];
  /** Percentage of adult weight this puppy has already reached. */
  percentGrown: number;
  /** Weeks until growth is essentially finished. */
  weeksRemaining: number;
  /** How much confidence the age justifies. */
  confidence: 'low' | 'moderate' | 'good';
  confidenceNote: string;
  /** Projected weight at future ages, for the chart. */
  projection: { weeks: number; lb: number }[];
}

/**
 * @param currentLb what the puppy weighs today
 * @param ageWeeks how old it is, in weeks
 */
export function predictAdultWeight(currentLb: number, ageWeeks: number, cls: GrowthClass): WeightPrediction {
  const def = growthClass(cls);
  const weeks = Math.max(4, ageWeeks);
  const fraction = fractionAt(def, weeks);
  const adult = currentLb / fraction;

  // Very young puppies carry the most error: a small absolute difference is a
  // large proportional one when they are only a fifth of their adult size.
  const spread = weeks < 12 ? 0.25 : weeks < 20 ? 0.18 : weeks < 32 ? 0.12 : 0.08;
  const confidence = weeks < 12 ? 'low' : weeks < 24 ? 'moderate' : 'good';
  const confidenceNote =
    weeks < 12
      ? 'Under 12 weeks the estimate is rough — small differences now scale up a long way.'
      : weeks < 24
        ? 'A reasonable estimate. It will tighten up considerably by six months.'
        : 'Most of the growing is done, so this estimate is the reliable kind.';

  const projection = def.curve
    .filter(([w]) => w >= weeks)
    .map(([w]) => ({ weeks: w, lb: Math.round(adult * fractionAt(def, w) * 10) / 10 }));

  return {
    adultLb: Math.round(adult * 10) / 10,
    rangeLb: [Math.round(adult * (1 - spread)), Math.round(adult * (1 + spread))],
    percentGrown: Math.round(fraction * 100),
    weeksRemaining: Math.max(0, def.matureWeeks - weeks),
    confidence,
    confidenceNote,
    projection,
  };
}

/** Weeks from a human-friendly months value. */
export const monthsToWeeks = (months: number): number => Math.round(months * 4.345);
