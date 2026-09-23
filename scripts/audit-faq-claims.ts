/**
 * Cross-check written FAQ answers against the breed record.
 *
 *   npx tsx scripts/audit-faq-claims.ts [--verbose]
 *
 * The duplication script proves the answers are not boilerplate. It says
 * nothing about whether they are true. This checks the claims that can be
 * checked mechanically:
 *
 *   - weights, heights and lifespans quoted in an answer must match the record
 *   - the shedding verdict must agree in direction with the shedding score
 *   - coat descriptions must not contradict the recorded coat
 *   - the hypoallergenic answer must not imply a breed is allergy-safe
 *   - answers must not hedge their way out of answering
 *
 * It cannot judge whether an answer is interesting, or whether a claim about
 * breed history is accurate. Those need a person.
 */

import fs from 'node:fs';
import path from 'node:path';

const API = process.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api';
const DATA = path.resolve(process.cwd(), 'src/data/faqs');
const verbose = process.argv.includes('--verbose');

interface Breed {
  name: string; slug: string;
  coatType?: string; coatLength?: string;
  weightMin?: number; weightMax?: number;
  heightMin?: number; heightMax?: number;
  lifeExpectancyMin?: number; lifeExpectancyMax?: number;
  traits?: Record<string, number>;
}

const res = await fetch(`${API}/breeds?where[status][equals]=published&limit=500&depth=0`);
const breeds = new Map<string, Breed>(((await res.json()).docs as Breed[]).map((b) => [b.slug, b]));

/** Words that claim little or no shedding, and words that claim a lot. */
const LOW_SHED = /sheds? (?:very )?little|minimal shedding|barely sheds|hardly sheds|low[- ]shedding|sheds almost nothing|negligible shedding/i;
const HIGH_SHED = /sheds? heavily|heavy shed|profusely|blows? (?:its |their )?coat|carpet|constant shedding|prolific shed/i;

/** Claims that would be wrong for every breed. */
const ALLERGY_SAFE = /\b(is|are) hypoallergenic\b|allergy[- ]free|safe for allergy sufferers|won'?t trigger allergies|no allergens/i;

/** Hedging that avoids answering the question. */
const HEDGE = /\bit depends\b|\bvaries (?:greatly|widely)\b|\bsome (?:dogs|individuals) (?:may|might|can)\b.{0,40}\bothers\b/i;

/** Sentences that would be true of almost any breed. */
const GENERIC = [
  /needs? (?:regular|daily) exercise and mental stimulation/i,
  /makes? (?:a|an) (?:wonderful|great|excellent|loyal) (?:companion|family|pet)/i,
  /with (?:proper|consistent) training and socialisation/i,
  /every dog is an individual/i,
  /thrives? on human companionship/i,
];

/**
 * Cues that flip a phrase's meaning, or attach it to a different dog.
 *
 * Without this the checker flags "rather than minimal shedding", "compared
 * with heavy shedders" and "is not low-shedding" as contradictions — all eight
 * of its first run's findings were this, and a checker that cries wolf gets
 * ignored.
 */
const NEGATION = /\b(not|never|nor|no|rather than|instead of|compared (?:with|to)|unlike|opposing|opposed to|than|other|far from|anything but|opposite of|a long way from)\b[^.]{0,40}$/i;

/** True when the match is negated or refers to other dogs. */
function isNegated(answer: string, index: number): boolean {
  return NEGATION.test(answer.slice(Math.max(0, index - 60), index));
}

/** First non-negated match of a pattern, or null. */
function findClaim(answer: string, pattern: RegExp): RegExpMatchArray | null {
  for (const m of answer.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))) {
    if (m.index !== undefined && !isNegated(answer, m.index)) return m;
  }
  return null;
}

interface Finding { slug: string; key: string; severity: 'check' | 'minor'; note: string; excerpt: string }
const findings: Finding[] = [];

const add = (slug: string, key: string, severity: Finding['severity'], note: string, excerpt: string) =>
  findings.push({ slug, key, severity, note, excerpt: excerpt.slice(0, 150) });

for (const file of fs.readdirSync(DATA).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf-8'));
  const breed = breeds.get(data.slug);
  if (!breed) continue;

  for (const [key, answerRaw] of Object.entries(data.answers as Record<string, string>)) {
    const answer = answerRaw as string;

    // ── Numbers quoted must match the record ──
    for (const m of answer.matchAll(/(\d+)\s*[-–—]\s*(\d+)\s*(lb|pounds|in|inches|years|yr)/gi)) {
      const [, lo, hi, unitRaw] = m;
      const unit = unitRaw.toLowerCase();
      const pair: [number | undefined, number | undefined] =
        unit.startsWith('lb') || unit.startsWith('pound') ? [breed.weightMin, breed.weightMax]
        : unit.startsWith('in') ? [breed.heightMin, breed.heightMax]
        : [breed.lifeExpectancyMin, breed.lifeExpectancyMax];
      if (pair[0] === undefined) continue;
      if (Number(lo) !== pair[0] || Number(hi) !== pair[1]) {
        add(data.slug, key, 'check', `quotes ${lo}-${hi} ${unit}, record says ${pair[0]}-${pair[1]}`, m[0]);
      }
    }

    // ── Shedding verdict vs shedding score ──
    const shed = breed.traits?.sheddingLevel;
    if (typeof shed === 'number' && (key === 'shedding' || key === 'hypoallergenic')) {
      if (findClaim(answer, LOW_SHED) && shed >= 6) {
        add(data.slug, key, 'check', `claims low shedding but score is ${shed}/10`, answer);
      }
      if (findClaim(answer, HIGH_SHED) && shed <= 3) {
        add(data.slug, key, 'check', `claims heavy shedding but score is ${shed}/10`, answer);
      }
    }

    // ── Coat contradictions ──
    if (findClaim(answer, /\bdouble coat\b/i) && /single/i.test(breed.coatType ?? '')) {
      add(data.slug, key, 'check', `says double coat, record says "${breed.coatType}"`, answer);
    }
    if (findClaim(answer, /\bshort[- ]coated?\b|\bshort coat\b/i) && /long/i.test(breed.coatLength ?? '')) {
      add(data.slug, key, 'check', `says short coat, record says "${breed.coatLength} ${breed.coatType}"`, answer);
    }
    if (findClaim(answer, /\blong[- ]coated?\b|\blong coat\b/i) && /short/i.test(breed.coatLength ?? '')) {
      add(data.slug, key, 'check', `says long coat, record says "${breed.coatLength} ${breed.coatType}"`, answer);
    }
    if (findClaim(answer, /\bhairless\b/i) && !/hairless/i.test(`${breed.coatType} ${breed.coatLength} ${breed.name}`)) {
      add(data.slug, key, 'check', 'describes the breed as hairless', answer);
    }

    // ── Allergy safety ──
    if (key === 'hypoallergenic' && findClaim(answer, ALLERGY_SAFE)) {
      add(data.slug, key, 'check', 'may read as claiming the breed is allergy-safe', answer);
    }
    if (key === 'hypoallergenic' && !/\bno breed\b|\bno dog\b|nor is any breed|none (?:are|is)\b|nothing on four legs|no such thing as a(?:n)? (?:genuinely )?hypoallergenic|hypoallergenic dogs? do(?:es)? not exist|no genuinely hypoallergenic|escapes? the allergen/i.test(answer)) {
      add(data.slug, key, 'minor', 'does not state that no breed is hypoallergenic', answer);
    }

    // ── Filler ──
    if (HEDGE.test(answer)) add(data.slug, key, 'minor', 'hedges instead of answering', answer);
    for (const pattern of GENERIC) {
      if (pattern.test(answer)) add(data.slug, key, 'minor', `generic phrasing: ${pattern.source.slice(0, 40)}`, answer);
    }
  }
}

const checks = findings.filter((f) => f.severity === 'check');
const minors = findings.filter((f) => f.severity === 'minor');

console.log(`\nAudited ${fs.readdirSync(DATA).filter((f) => f.endsWith('.json')).length} breeds.\n`);
console.log(`  Factual conflicts with the record: ${checks.length}`);
console.log(`  Filler / weak phrasing:            ${minors.length}\n`);

for (const group of [checks, minors]) {
  if (!group.length) continue;
  console.log(group === checks ? '── Worth checking ──' : '── Minor ──');
  for (const f of group.slice(0, verbose ? group.length : 20)) {
    console.log(`  ${f.slug}/${f.key}: ${f.note}`);
    if (verbose) console.log(`      "${f.excerpt}"`);
  }
  if (!verbose && group.length > 20) console.log(`  … and ${group.length - 20} more (--verbose)`);
  console.log();
}
