/**
 * Dog pregnancy due-date calculator.
 *
 * Canine gestation is about 63 days — but from ovulation, not from mating.
 * That distinction is the reason breeders get surprised: sperm survive in the
 * reproductive tract for up to a week, so a bitch mated on day one may not
 * conceive until day six. Counting from a mating date therefore gives a
 * window (roughly 57–65 days), while counting from a progesterone-timed
 * ovulation gives a date accurate to a day or two.
 *
 * The milestones matter as much as the date: when a scan will show anything,
 * when an X-ray can count puppies, and what the temperature drop before labour
 * means.
 */

export type DateBasis = 'mating' | 'ovulation' | 'lh-surge';

export interface BasisDef {
  key: DateBasis;
  label: string;
  /** Days from this event to whelping. */
  days: number;
  /** Plus or minus, in days. */
  spread: number;
  description: string;
}

export const BASES: BasisDef[] = [
  {
    key: 'mating',
    label: 'First mating',
    days: 63,
    spread: 5,
    description: 'The usual starting point, and the least precise: sperm can survive several days, so conception may be days after the mating.',
  },
  {
    key: 'ovulation',
    label: 'Ovulation (progesterone-timed)',
    days: 63,
    spread: 2,
    description: 'If your vet timed ovulation by progesterone testing, this is the accurate one — normally within a day or two.',
  },
  {
    key: 'lh-surge',
    label: 'LH surge',
    days: 65,
    spread: 2,
    description: 'Ovulation follows the LH surge by about two days, so whelping is around 65 days after it.',
  },
];

export function basisFor(key: DateBasis): BasisDef {
  return BASES.find((b) => b.key === key) ?? BASES[0];
}

export interface Milestone {
  day: number;
  date: Date;
  title: string;
  detail: string;
  /** Milestones that need a vet appointment booked. */
  vet?: boolean;
  past?: boolean;
}

export interface PregnancyResult {
  dueDate: Date;
  windowStart: Date;
  windowEnd: Date;
  /** Days elapsed since the starting event, if the date is in the past. */
  dayOfPregnancy: number | null;
  daysRemaining: number | null;
  /** Which third of the pregnancy she is in. */
  trimester: 1 | 2 | 3 | null;
  milestones: Milestone[];
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * Milestones counted from the start event. Days shift slightly with the basis,
 * so they are expressed relative to the calculated whelping date where that
 * matters clinically.
 */
const MILESTONE_TEMPLATE: { day: number; title: string; detail: string; vet?: boolean }[] = [
  { day: 0, title: 'Starting point', detail: 'Day zero for this calculation.' },
  { day: 7, title: 'Fertilisation complete', detail: 'Embryos are travelling to the uterus. Nothing is visible yet and she will seem entirely normal.' },
  { day: 16, title: 'Implantation', detail: 'Embryos implant in the uterine wall. Some bitches go off their food around now.' },
  { day: 21, title: 'Morning sickness possible', detail: 'A few days of reduced appetite or nausea are common and usually pass quickly.' },
  { day: 25, title: 'Ultrasound can confirm pregnancy', detail: 'An ultrasound from about day 25 can confirm pregnancy and check for heartbeats. It cannot reliably count puppies.', vet: true },
  { day: 35, title: 'Appetite climbs', detail: 'Energy needs start rising. Most vets advise moving to a puppy or performance food around now, fed in more frequent, smaller meals.' },
  { day: 45, title: 'X-ray can count puppies', detail: 'From about day 45 the puppies\' skeletons are mineralised enough to be counted on X-ray. Knowing the number matters during whelping — it tells you when she is finished.', vet: true },
  { day: 50, title: 'Prepare the whelping box', detail: 'Set it up now and let her sleep in it, so it is familiar rather than novel when labour starts.' },
  { day: 55, title: 'Start taking her temperature', detail: 'Twice daily. Normal is about 101–102.5°F (38.3–39.2°C). You are watching for the drop below 100°F (37.8°C) that usually comes 12–24 hours before labour.' },
  { day: 58, title: 'Whelping window opens', detail: 'Puppies born from day 58 are generally viable. From here on she should not be left alone for long.' },
  { day: 63, title: 'Due date', detail: 'The average. Perfectly normal births happen either side of it.' },
  { day: 65, title: 'Whelping window closes', detail: 'Past this point, call your vet. Going beyond about day 65 from ovulation — or showing no sign of labour 24 hours after the temperature drop — needs veterinary advice.', vet: true },
];

export function calculatePregnancy(startDate: Date, basisKey: DateBasis, today = new Date()): PregnancyResult {
  const basis = basisFor(basisKey);
  const dueDate = addDays(startDate, basis.days);
  const windowStart = addDays(startDate, basis.days - basis.spread);
  const windowEnd = addDays(startDate, basis.days + basis.spread);

  const msPerDay = 24 * 60 * 60 * 1000;
  const elapsed = Math.floor((today.getTime() - startDate.getTime()) / msPerDay);
  const inProgress = elapsed >= 0 && elapsed <= basis.days + basis.spread;

  const milestones: Milestone[] = MILESTONE_TEMPLATE.map((m) => {
    // Shift the late milestones so they stay correct relative to the due date
    // when the basis is not the standard 63 days.
    const day = m.day >= 55 ? m.day + (basis.days - 63) : m.day;
    return {
      ...m,
      day,
      date: addDays(startDate, day),
      past: elapsed >= day,
    };
  });

  return {
    dueDate,
    windowStart,
    windowEnd,
    dayOfPregnancy: inProgress ? elapsed : null,
    daysRemaining: inProgress ? Math.max(0, basis.days - elapsed) : null,
    trimester: inProgress ? (elapsed < 21 ? 1 : elapsed < 42 ? 2 : 3) : null,
    milestones,
  };
}

/** Signs that whelping has become an emergency. */
export const WHELPING_RED_FLAGS = [
  'Strong contractions for 30 minutes with no puppy produced',
  'More than 2 hours between puppies when more are known to be due',
  'Longer than 24 hours after the temperature drop with no labour',
  'Green or black discharge before the first puppy arrives',
  'Fresh bleeding, or obvious pain and distress',
  'Past day 65 from ovulation with no sign of labour',
  'A puppy visible in the birth canal but not delivered within 10 minutes',
];
