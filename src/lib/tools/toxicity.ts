/**
 * Chocolate and grape/raisin exposure checker.
 *
 * This is the one tool on the site where being wrong has immediate
 * consequences, so it is built to a different rule from the others: it never
 * tells anyone their dog is fine.
 *
 * Chocolate poisoning is dose-dependent and genuinely calculable — toxicity
 * tracks methylxanthines (theobromine plus caffeine) per kilogram of body
 * weight, and the concentration varies enormously by chocolate type. A
 * calculator adds real value here, because "my dog ate chocolate" spans
 * everything from a lick of white chocolate to a fatal dose of cocoa powder.
 *
 * Grapes and raisins are the opposite case. There is no established toxic
 * dose. Some dogs eat a bagful with no effect; others develop acute kidney
 * injury from a handful. The mechanism is still not settled. Any tool that
 * returns a "safe amount" for grapes is inventing one, so this does not
 * compute a dose at all — every grape ingestion routes straight to "call
 * someone now".
 *
 * Nothing here replaces a vet, and every code path says so.
 */

export const EMERGENCY_CONTACTS = [
  {
    region: 'US',
    name: 'ASPCA Animal Poison Control Center',
    phone: '(888) 426-4435',
    note: 'Open 24/7. A consultation fee may apply.',
    href: 'tel:+18884264435',
  },
  {
    region: 'US',
    name: 'Pet Poison Helpline',
    phone: '(855) 764-7661',
    note: 'Open 24/7. A consultation fee may apply.',
    href: 'tel:+18557647661',
  },
  {
    region: 'UK',
    name: 'Animal PoisonLine',
    phone: '01202 509000',
    note: 'Open 24/7. A fee applies. Not a substitute for calling your own vet.',
    href: 'tel:+441202509000',
  },
];

export interface ChocolateType {
  key: string;
  label: string;
  /** Theobromine, mg per ounce. */
  theobromine: number;
  /** Caffeine, mg per ounce. */
  caffeine: number;
  note: string;
}

/**
 * Methylxanthine content by chocolate type, mg per ounce.
 *
 * The spread is the important part: cocoa powder carries well over a hundred
 * times the theobromine of white chocolate, so "ate chocolate" on its own says
 * almost nothing about risk. Published figures vary between sources and
 * between products; these sit mid-range, and the page says the result is an
 * estimate for that reason.
 */
export const CHOCOLATE_TYPES: ChocolateType[] = [
  { key: 'white', label: 'White chocolate', theobromine: 0.25, caffeine: 0.85, note: 'Barely any methylxanthine. The fat and sugar can still upset a stomach or, in large amounts, trigger pancreatitis.' },
  { key: 'milk', label: 'Milk chocolate', theobromine: 58, caffeine: 6, note: 'The commonest culprit: chocolate bars, buttons, most filled boxes.' },
  { key: 'dark', label: 'Dark or semi-sweet', theobromine: 150, caffeine: 22, note: 'Around three times the strength of milk chocolate.' },
  { key: 'extra-dark', label: 'Extra dark (70%+)', theobromine: 228, caffeine: 26, note: 'Higher cocoa solids mean proportionally more theobromine.' },
  { key: 'baking', label: 'Baking chocolate (unsweetened)', theobromine: 393, caffeine: 47, note: 'One of the most dangerous forms. A single square is a serious dose for a small dog.' },
  { key: 'cocoa-powder', label: 'Cocoa powder', theobromine: 737, caffeine: 70, note: 'The most concentrated common form.' },
  { key: 'cocoa-mulch', label: 'Cocoa bean mulch', theobromine: 255, caffeine: 12, note: 'Garden mulch made from cocoa shells. Dogs eat it because it smells of chocolate.' },
];

export function chocolateType(key: string): ChocolateType {
  return CHOCOLATE_TYPES.find((c) => c.key === key) ?? CHOCOLATE_TYPES[1];
}

export type RiskLevel = 'monitor' | 'concerning' | 'serious' | 'critical';

export interface ChocolateAssessment {
  /** Total methylxanthines consumed, mg. */
  totalMg: number;
  /** Dose per kilogram of body weight. */
  mgPerKg: number;
  level: RiskLevel;
  headline: string;
  /** What this dose is associated with in the literature. */
  expected: string;
  /** What to do, in order. */
  action: string;
  /** Signs to watch for at this dose. */
  signs: string[];
}

/**
 * Risk bands by methylxanthine dose, mg/kg.
 *
 * Deliberately conservative at the bottom: the lowest band is "below the level
 * usually associated with signs", not "safe". Individual sensitivity varies,
 * dogs with heart conditions are at risk at lower doses, and the person using
 * this has usually guessed at the amount eaten.
 */
const BANDS: { max: number; level: RiskLevel; headline: string; expected: string; signs: string[] }[] = [
  {
    max: 20,
    level: 'monitor',
    headline: 'Below the dose usually linked to poisoning — but call your vet anyway',
    expected: 'Doses under about 20 mg/kg are not usually associated with signs of methylxanthine poisoning. Fat and sugar can still cause vomiting, diarrhoea or, in larger amounts, pancreatitis.',
    signs: ['Vomiting', 'Diarrhoea', 'Thirst', 'Restlessness'],
  },
  {
    max: 40,
    level: 'concerning',
    headline: 'Enough to expect stomach upset and restlessness',
    expected: 'Doses from roughly 20 mg/kg are associated with vomiting, diarrhoea, increased thirst and agitation.',
    signs: ['Vomiting', 'Diarrhoea', 'Excessive thirst', 'Restlessness or hyperactivity', 'Panting'],
  },
  {
    max: 60,
    level: 'serious',
    headline: 'In the range associated with heart effects — treat as urgent',
    expected: 'From roughly 40 mg/kg, cardiac effects become likely: a racing heart, abnormal rhythms and raised blood pressure.',
    signs: ['Racing heart', 'Abnormal heart rhythm', 'Tremors', 'Severe restlessness', 'Vomiting and diarrhoea'],
  },
  {
    max: Infinity,
    level: 'critical',
    headline: 'In the range associated with seizures. Treat this as an emergency',
    expected: 'From roughly 60 mg/kg, seizures and life-threatening heart rhythms are reported. Doses at this level have been fatal.',
    signs: ['Seizures', 'Collapse', 'Dangerous heart rhythms', 'Muscle rigidity', 'High temperature'],
  },
];

const ACTIONS: Record<RiskLevel, string> = {
  monitor:
    'Phone your vet or a poison line and tell them the type, amount and your dog\'s weight. They may simply advise watching at home — but that is their call to make, not a calculator\'s.',
  concerning:
    'Phone your vet or a poison line now. If it was eaten within the last hour or two, they may want to induce vomiting, which needs to happen quickly.',
  serious:
    'Phone your vet now and tell them you are coming. Do not wait to see whether signs develop.',
  critical:
    'This is an emergency. Go to a vet immediately and phone on the way so they can prepare.',
};

/**
 * @param weightLb   the dog's weight in pounds
 * @param amountOz   how much chocolate was eaten, in ounces
 * @param typeKey    which kind of chocolate
 */
export function assessChocolate(weightLb: number, amountOz: number, typeKey: string): ChocolateAssessment {
  const type = chocolateType(typeKey);
  const kg = Math.max(0.5, weightLb) / 2.20462;
  const totalMg = amountOz * (type.theobromine + type.caffeine);
  const mgPerKg = totalMg / kg;

  const band = BANDS.find((b) => mgPerKg < b.max) ?? BANDS[BANDS.length - 1];

  return {
    totalMg: Math.round(totalMg),
    mgPerKg: Math.round(mgPerKg * 10) / 10,
    level: band.level,
    headline: band.headline,
    expected: band.expected,
    action: ACTIONS[band.level],
    signs: band.signs,
  };
}

/**
 * Grapes and raisins.
 *
 * No dose is calculated, because no reliable dose-response relationship
 * exists. Toxicity appears idiosyncratic: some dogs are unaffected by large
 * quantities while others develop acute kidney injury after a few. Current
 * thinking points at tartaric acid, to which dogs seem unusually sensitive,
 * but sensitivity still varies between individuals.
 *
 * The output is therefore the same whatever the amount: contact a vet now.
 */
export interface GrapeAssessment {
  headline: string;
  explanation: string;
  action: string;
  signs: string[];
  timeline: string;
}

export function assessGrapes(): GrapeAssessment {
  return {
    headline: 'Any amount is treated as an emergency. Phone your vet now.',
    explanation:
      'There is no known safe quantity of grapes, raisins, sultanas or currants for dogs. Toxicity does not track the amount eaten the way chocolate does: some dogs eat a large number with no ill effect, while others develop acute kidney injury from a handful. Because there is no way to tell in advance which kind of dog yours is, the veterinary advice is to treat every ingestion as potentially serious.',
    action:
      'Phone your vet or a poison line immediately, whatever the amount. If it was eaten recently they will usually want to make your dog sick and start intravenous fluids — which works far better before kidney damage begins than after.',
    signs: [
      'Vomiting, often within a few hours',
      'Lethargy, weakness or unusual quietness',
      'Loss of appetite',
      'Drinking or urinating more than usual — or producing no urine at all',
      'Abdominal pain',
    ],
    timeline:
      'Vomiting often appears within 6–12 hours. Signs of kidney injury can take 24–72 hours to show, by which point treatment is much harder. A dog that seems well the same evening is not in the clear.',
  };
}

/** Other common household poisons, so the page is useful beyond its two foods. */
export const OTHER_HAZARDS = [
  { name: 'Xylitol (birch sugar)', note: 'In sugar-free gum, some peanut butters, baked goods. Causes a dangerous drop in blood sugar and liver failure. Extremely toxic in tiny amounts — treat as an emergency.' },
  { name: 'Onions, garlic, leeks, chives', note: 'Damage red blood cells. Cooked, raw or powdered all count, and signs can take days to appear.' },
  { name: 'Macadamia nuts', note: 'Cause weakness, tremors and fever, typically within 12 hours.' },
  { name: 'Alcohol and raw bread dough', note: 'Dough ferments in the stomach and produces alcohol. Both can be life-threatening.' },
  { name: 'Ibuprofen, paracetamol and other human painkillers', note: 'Never give human painkillers to a dog. They cause stomach ulcers and kidney or liver failure.' },
];
