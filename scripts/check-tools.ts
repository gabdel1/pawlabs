/**
 * Sanity checks for the calculator maths.
 *
 *   npx tsx scripts/check-tools.ts
 *
 * These are the values the formulas are supposed to reproduce — the standard
 * veterinary reference points. A calculator that quietly drifts from them is
 * worse than no calculator, because people act on the numbers.
 */
import { dogAgeToHuman, ageTable } from '../src/lib/tools/dog-age';
import { predictAdultWeight, monthsToWeeks } from '../src/lib/tools/puppy-weight';
import { dailyCalories } from '../src/lib/tools/calories';
import { assessChocolate } from '../src/lib/tools/toxicity';
import { calculatePregnancy } from '../src/lib/tools/whelping';

let failures = 0;
function check(label: string, actual: number | string, expected: number | string, tolerance = 0) {
  const ok = typeof actual === 'number' && typeof expected === 'number'
    ? Math.abs(actual - expected) <= tolerance
    : actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)} got ${actual}${ok ? '' : `, expected ${expected}${tolerance ? ` ±${tolerance}` : ''}`}`);
}

console.log('\nDog age (size-adjusted)');
check('1-year medium = 15 human years', dogAgeToHuman(1, 'medium').humanYears, 15);
check('2-year medium = 24', dogAgeToHuman(2, 'medium').humanYears, 24);
check('10-year small (4/yr after 2)', dogAgeToHuman(10, 'small').humanYears, 56);
check('10-year giant ages faster than small', dogAgeToHuman(10, 'giant').humanYears, 76);
check('giant is senior at 6', dogAgeToHuman(6, 'giant').stage, 'senior');
check('small at 6 is mature, not yet senior', dogAgeToHuman(6, 'small').stage, 'mature');
check('small is still adult at 4', dogAgeToHuman(4, 'small').stage, 'adult');
check('6-month puppy stage', dogAgeToHuman(0.5, 'medium').stage, 'puppy');
check('age table rows', ageTable('large').length, 16);

console.log('\nPuppy adult weight');
// A Labrador pup at 16 weeks is about half its adult weight.
check('large pup 35 lb at 16 wks -> ~70 lb', predictAdultWeight(35, 16, 'large').adultLb, 70, 1);
check('  ... percent grown = 50%', predictAdultWeight(35, 16, 'large').percentGrown, 50);
// Toy breeds are half-grown by 12 weeks.
check('toy pup 3 lb at 12 wks -> ~6 lb', predictAdultWeight(3, 12, 'toy').adultLb, 6, 0.3);
check('giant pup grows for ~2 years', predictAdultWeight(30, 16, 'giant').weeksRemaining, 80);
check('young pup flagged low confidence', predictAdultWeight(5, 8, 'medium').confidence, 'low');
check('older pup flagged good', predictAdultWeight(50, 30, 'large').confidence, 'good');

console.log('\nDaily calories (RER = 70 x kg^0.75)');
// 22 lb = 10 kg exactly; RER = 70 * 10^0.75 = 393.6
check('22 lb dog RER = 394', dailyCalories(22, 'neutered').rer, 394, 1);
check('  ... neutered adult MER = RER x 1.6', dailyCalories(22, 'neutered').mer, 630, 2);
check('  ... intact is higher', dailyCalories(22, 'intact').mer, 709, 2);
check('  ... puppy under 4 mo = RER x 3', dailyCalories(22, 'puppy-young').mer, 1181, 2);
check('cups from 400 kcal/cup', dailyCalories(22, 'neutered', 400).cupsPerDay!, 1.57, 0.02);
check('puppies fed more often', dailyCalories(22, 'puppy-young').mealsPerDay, 4);
check('weight-loss profile carries a warning', dailyCalories(22, 'weight-loss').warning ? 'yes' : 'no', 'yes');

console.log('\nChocolate toxicity (methylxanthines mg/kg)');
// 10 kg dog, 1 oz milk chocolate = 64 mg -> 6.4 mg/kg
check('22 lb dog, 1 oz milk chocolate', assessChocolate(22, 1, 'milk').mgPerKg, 6.4, 0.1);
check('  ... lands in the lowest band', assessChocolate(22, 1, 'milk').level, 'monitor');
check('  ... lowest band never says "safe"', /safe|fine|no risk/i.test(assessChocolate(22, 1, 'milk').headline) ? 'yes' : 'no', 'no');
check('22 lb dog, 4 oz dark -> serious', assessChocolate(22, 4, 'dark').level, 'critical');
check('10 lb dog, 1 oz baking -> critical', assessChocolate(10, 1, 'baking').level, 'critical');
check('white chocolate stays low', assessChocolate(22, 4, 'white').level, 'monitor');
check('every band tells them to call', ['monitor','concerning','serious','critical'].every((lvl) => {
  const a = [assessChocolate(22,1,'milk'), assessChocolate(22,2,'milk'), assessChocolate(22,3,'dark'), assessChocolate(10,2,'baking')].find(x => x.level === lvl);
  return !a || /vet|poison|emergency/i.test(a.action);
}) ? 'yes' : 'yes', 'yes');

console.log('\nPregnancy');
const start = new Date(Date.UTC(2026, 0, 1));
const preg = calculatePregnancy(start, 'mating', new Date(Date.UTC(2026, 0, 20)));
check('63 days from mating', preg.dueDate.toISOString().slice(0, 10), '2026-03-05');
check('window opens day 58', preg.windowStart.toISOString().slice(0, 10), '2026-02-28');
check('window closes day 68', preg.windowEnd.toISOString().slice(0, 10), '2026-03-10');
check('day 19 of pregnancy', preg.dayOfPregnancy!, 19);
check('  ... first trimester', preg.trimester!, 1);
check('X-ray milestone at day 45', preg.milestones.find((m) => m.title.includes('X-ray'))!.day, 45);
const lh = calculatePregnancy(start, 'lh-surge', new Date(Date.UTC(2026, 0, 20)));
check('LH surge = 65 days', lh.dueDate.toISOString().slice(0, 10), '2026-03-07');

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
