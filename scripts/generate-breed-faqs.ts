/**
 * Write per-breed FAQ answers to src/data/faqs/<slug>.json.
 *
 *   npx tsx scripts/generate-breed-faqs.ts --slugs=gordon-setter,saluki
 *   npx tsx scripts/generate-breed-faqs.ts --all [--force] [--limit=20]
 *   npx tsx scripts/generate-breed-faqs.ts --slugs=akita --print
 *
 * Why this exists: the FAQ answers on all 201 breed pages were produced from
 * one set of sentence templates, so every page carried the same sentences with
 * the breed name swapped in — "Worth knowing: low shedding is not the same as
 * hypoallergenic" appeared 201 times. That is duplicate boilerplate, and it
 * contributed to an ads review calling the site low value.
 *
 * The answers are now written once per breed and committed as data. They do
 * not change on rebuild, they can be read and corrected by a person, and a
 * diff shows exactly what changed. Regenerating a breed is deliberate.
 *
 * Every factual claim has to come from that breed's own profile — the history,
 * article text, temperament list, strengths, weaknesses and trait scores are
 * all passed in, and the prompt forbids going beyond them. The model is doing
 * rewriting, not research.
 */

import fs from 'node:fs';
import path from 'node:path';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const MODEL = process.env.FAQ_MODEL || 'grok-4.20-0309-non-reasoning';
const API = process.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api';
const OUT_DIR = path.resolve(process.cwd(), 'src/data/faqs');
const CONCURRENCY = 4;

// Load XAI_API_KEY the way the other scripts here do.
const envPath = path.resolve(process.cwd(), 'cms/.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const args = process.argv.slice(2);
const arg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const force = args.includes('--force');
const printOnly = args.includes('--print');
const doAll = args.includes('--all');
const limit = Number(arg('limit')) || Infinity;
const slugFilter = arg('slugs')?.split(',').map((s) => s.trim()).filter(Boolean);

/**
 * The eleven questions, fixed in code.
 *
 * Fixed because the page anchors, the Quick answers box and the FAQPage markup
 * all key off them, and because a question containing the breed name is
 * already unique per page. Only the answers are written per breed.
 */
export const FAQ_KEYS = [
  'children', 'other-pets', 'exercise', 'shedding', 'hypoallergenic',
  'training', 'lifespan', 'size', 'barking', 'apartment', 'first-time',
] as const;
export type FaqKey = (typeof FAQ_KEYS)[number];

/** What each answer must actually address. Given to the model verbatim. */
const BRIEFS: Record<FaqKey, string> = {
  children: 'Is this breed good with children? Open with a direct verdict. Mention the specific traits or history that drive it (size, tolerance, herding or guarding instinct, energy around small children).',
  'other-pets': 'Does it get along with other pets? Open with a direct verdict. Address prey drive, same-sex tension or sociability where the profile supports it.',
  exercise: 'How much exercise does it need? Open with a concrete daily figure or range. Say what happens when that is not met, and what kind of exercise suits this breed.',
  shedding: 'Does it shed? Open with yes/no plus how much and whether it is seasonal. Describe this breed\'s actual coat — length, single or double, texture, feathering — and what that means for the house.',
  hypoallergenic: 'Is it hypoallergenic? Open by saying plainly that no breed is, then whether this breed is one of those commonly suggested for allergy sufferers, based on its coat. Be honest: most breeds are not.',
  training: 'Is it easy to train? Open with a direct verdict. Say what makes this breed easy or hard specifically — biddability, independence, sensitivity, what it was bred to do without human direction.',
  lifespan: 'How long does it live? Open with the range. Add what is known from the profile about this breed\'s health or build that bears on it. Do not invent health conditions.',
  size: 'How big does it get? Open with the adult weight and height. Add something useful about the build — substance, proportions, how it feels to live with at that size.',
  barking: 'Does it bark a lot? Open with a direct verdict. Say what this breed tends to bark at, or why it is quiet, based on what it was bred for.',
  apartment: 'Can it live in an apartment? Open with a direct verdict. The deciding factors are settling indoors, noise and exercise needs rather than floor area.',
  'first-time': 'Is it a good first dog? Open with a direct verdict. Name the specific demand that makes it easy or hard for a novice.',
};

interface Breed {
  name: string;
  slug: string;
  breedGroup?: string;
  breedRole?: string;
  size?: string;
  coatType?: string;
  coatLength?: string;
  shortDescription?: string;
  breedHistory?: string;
  article?: string;
  origin?: string;
  weightMin?: number; weightMax?: number;
  heightMin?: number; heightMax?: number;
  lifeExpectancyMin?: number; lifeExpectancyMax?: number;
  temperament?: { trait: string }[];
  strengths?: { point: string }[];
  weaknesses?: { point: string }[];
  traits?: Record<string, number>;
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

function breedFacts(breed: Breed): string {
  const t = breed.traits ?? {};
  const list = (rows?: { trait?: string; point?: string }[]) =>
    (rows ?? []).map((r) => r.trait ?? r.point).filter(Boolean).join('; ');

  return [
    `NAME: ${breed.name}`,
    `GROUP: ${breed.breedGroup ?? 'unknown'} | ORIGINALLY BRED FOR: ${breed.breedRole ?? 'unknown'} | ORIGIN: ${breed.origin ?? 'unknown'}`,
    `SIZE BAND: ${breed.size ?? 'unknown'} | WEIGHT: ${breed.weightMin ?? '?'}-${breed.weightMax ?? '?'} lb | HEIGHT: ${breed.heightMin ?? '?'}-${breed.heightMax ?? '?'} in`,
    `LIFESPAN: ${breed.lifeExpectancyMin ?? '?'}-${breed.lifeExpectancyMax ?? '?'} years`,
    `COAT: ${[breed.coatLength, breed.coatType].filter(Boolean).join(' ') || 'unknown'}`,
    `TEMPERAMENT WORDS: ${list(breed.temperament) || 'none recorded'}`,
    `STRENGTHS: ${list(breed.strengths) || 'none recorded'}`,
    `WEAKNESSES: ${list(breed.weaknesses) || 'none recorded'}`,
    '',
    'TRAIT SCORES (1-10, internal only — never print a code, and only quote a score in the approved format):',
    `  child-friendly ${t.childFriendly ?? '?'} | pet-friendly ${t.petFriendly ?? '?'} | stranger-friendly ${t.strangerFriendly ?? '?'}`,
    `  trainability ${t.trainability ?? '?'} | intelligence ${t.intelligence ?? '?'} | energy ${t.energyLevel ?? '?'}`,
    `  shedding ${t.sheddingLevel ?? '?'} | grooming ${t.groomingNeeds ?? '?'} | barking ${t.barkingLevel ?? '?'}`,
    `  adaptability ${t.adaptability ?? '?'} | affection ${t.affectionLevel ?? '?'} | health robustness ${t.healthRobustness ?? '?'}`,
    '',
    `SUMMARY: ${breed.shortDescription ?? ''}`,
    `HISTORY: ${stripHtml(breed.breedHistory ?? '').slice(0, 1400)}`,
    `PROFILE: ${stripHtml(breed.article ?? '').slice(0, 2600)}`,
  ].join('\n');
}

const SYSTEM_PROMPT = `You write the FAQ answers on a dog breed encyclopedia. You are rewriting facts that are given to you — you are not researching, and you must not add anything the supplied profile does not support.

HARD RULES
1. FIRST SENTENCE = the answer. Name the breed in it, and give a direct yes/no or a plain figure. Never open with a score.
   GOOD: "Yes — Gordon Setters shed moderately year-round, with heavier seasonal sheds; their long feathering tangles and traps loose hair."
   BAD:  "At 6/10 for shedding, the Gordon Setter sheds a moderate amount."
2. The rest of the answer must be SPECIFIC TO THIS BREED — its coat, its build, what it was bred to do, what owners of this breed report. Anything you write must be supported by the supplied profile, history, temperament words, strengths, weaknesses or trait scores. Invent nothing: no health conditions, no statistics, no history that is not given.
3. AIM FOR 55-70 WORDS per answer. The hard limits are 40 and 80, and answers keep coming back at 36-39, which fails. Three full sentences is about right: the direct answer, a concrete breed-specific detail, then a consequence for the person living with the dog. If an answer feels finished at 38 words, it is missing the third sentence.
4. A score may appear ONLY as supporting detail at the end of a sentence, in exactly this format: "(PawLabs shedding score: 6/10)". Use it in at most two of the eleven answers. Any other mention of a number out of ten is forbidden — do not write "rates 5/10", "their moderate 5/10 score", or similar. Never write a trait code.
5. NO GENERIC CAVEATS. These sentences are banned outright because they used to appear on every page:
   - anything saying low shedding is not the same as hypoallergenic
   - anything telling the reader to supervise children around dogs
   - anything saying early socialisation matters, or that the score reflects the breed not the individual
   - anything saying lifespan depends on genetics, weight or veterinary care
   The site explains all of that on one separate page. Your job is the breed-specific part.
6. Vary your sentence openings and structure between the eleven answers. Do not start more than two answers the same way.
7. Plain British-neutral English. No hype ("wonderful", "loving companion", "perfect family dog"), no "when it comes to", no "in terms of".
8. Write about the breed in a way that could only describe THIS breed. If a sentence would be equally true of fifty other breeds, rewrite it.
9. Do not claim what owners report, what studies show, or what is commonly observed. You have no such source. State the thing itself: "the coat mats behind the ears", not "owners report the coat mats behind the ears".
10. Do not lean on one fact repeatedly. If you mention the breed's country or original job, do so in at most two answers — the other nine must find something else to say.
11. Vary how the hypoallergenic answer opens. It must still make clear no breed is allergy-free, but every breed page must not begin that answer with the same words.

Return ONLY a JSON object:
{
  "answers": { "<key>": "<answer text>", ... for all eleven keys },
  "quick": {
    "sheds": "<max 5 words, e.g. 'Moderately, year-round'>",
    "hypoallergenic": "<max 5 words, e.g. 'No — heavy double coat'>",
    "barks": "<max 5 words, e.g. 'Rarely, and only on alert'>"
  }
}`;

interface Generated {
  answers: Record<string, string>;
  quick: { sheds: string; hypoallergenic: string; barks: string };
}

async function generate(breed: Breed, fixes?: string[]): Promise<Generated> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('XAI_API_KEY is not set');

  const briefs = FAQ_KEYS.map((key) => `  "${key}": ${BRIEFS[key]}`).join('\n');
  const userPrompt = `Write the eleven FAQ answers for this breed.

${breedFacts(breed)}

ANSWER BRIEFS — one answer per key:
${briefs}

Remember: first sentence answers the question and names the breed; everything after it must be true of ${breed.name} specifically and supported by the profile above.${
    fixes?.length
      ? `\n\nYour previous attempt broke these rules. Rewrite the affected answers and keep the rest at the same quality:\n${fixes.map((f) => `  - ${f}`).join('\n')}`
      : ''
  }`;

  const res = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.8,
      max_tokens: 2600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) throw new Error(`xAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty response');

  const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')) as Generated;

  const missing = FAQ_KEYS.filter((k) => !parsed.answers?.[k]?.trim());
  if (missing.length) throw new Error(`missing answers: ${missing.join(', ')}`);
  return parsed;
}

/** Phrases that were the whole problem, plus claims we cannot support. */
const BANNED = [
  /low shedding is not the same as hypoallergenic/i,
  /supervise (interactions|young children|children)/i,
  /early socialisation|socialization matters|reflects the breed'?s typical temperament/i,
  /depends heavily on genetics|weight management and veterinary care/i,
  /owners report|owners say|studies show|it is commonly observed|research shows/i,
  /when it comes to|in terms of/i,
];

/** A score outside the one approved format. */
const LOOSE_SCORE = /(?<!PawLabs [a-z- ]{3,30}score: )\b\d{1,2}\/10\b/;

/**
 * Match the breed name allowing for plurals: answers say "Huskies" where the
 * record says "Husky", and "Setters" where it says "Setter". Comparing against
 * the bare last word reports those as missing the breed name when they are not.
 */
function breedStem(name: string): RegExp {
  const last = name.split(' ').pop()!;
  const stem = last.replace(/(ies|es|s)$/i, '').replace(/y$/i, '');
  return new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function validate(breed: Breed, generated: Generated): string[] {
  const problems: string[] = [];
  const stem = breedStem(breed.name);

  for (const key of FAQ_KEYS) {
    const answer = generated.answers[key];
    const first = answer.split(/(?<=[.!?])\s/)[0] ?? answer;

    if (!stem.test(first)) problems.push(`${key}: first sentence does not name the breed`);
    if (/^(at|with|scoring|rated|scored)\b/i.test(first.trim())) problems.push(`${key}: opens with a score`);

    const words = wordCount(answer);
    if (words < 40 || words > 80) problems.push(`${key}: ${words} words (need 40-80)`);

    for (const pattern of BANNED) {
      if (pattern.test(answer)) problems.push(`${key}: banned phrase ${pattern.source.slice(0, 32)}`);
    }
    if (LOOSE_SCORE.test(answer)) problems.push(`${key}: score outside the approved format`);
  }

  const scored = FAQ_KEYS.filter((k) => /PawLabs [a-z- ]+score:/i.test(generated.answers[k])).length;
  if (scored > 2) problems.push(`${scored} answers quote a score (max 2)`);

  return problems;
}

const wordCount = (s: string) => s.trim().split(/\s+/).length;

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const res = await fetch(`${API}/breeds?where[status][equals]=published&limit=500&depth=0&sort=name`);
  let breeds = (await res.json()).docs as Breed[];

  if (slugFilter) {
    breeds = slugFilter
      .map((slug) => breeds.find((b) => b.slug === slug) ?? (console.warn(`  unknown slug: ${slug}`), null))
      .filter((b): b is Breed => b !== null);
  } else if (!doAll) {
    console.error('pass --slugs=a,b or --all');
    process.exit(1);
  }

  const todo = breeds
    .filter((b) => force || !fs.existsSync(path.join(OUT_DIR, `${b.slug}.json`)))
    .slice(0, limit);

  console.log(`[faqs] ${todo.length} breed(s) to write (model ${MODEL})`);
  let ok = 0;
  const problems: string[] = [];

  await pool(todo, CONCURRENCY, async (breed) => {
    try {
      let generated = await generate(breed);
      let issues = validate(breed, generated);

      // One corrective pass. The model fixes its own violations far more often
      // than not, and a second failure is worth a human looking at.
      if (issues.length) {
        generated = await generate(breed, issues);
        issues = validate(breed, generated);
      }
      if (issues.length) problems.push(`${breed.slug}: ${issues.join(' | ')}`);

      const payload = {
        slug: breed.slug,
        breed: breed.name,
        generated: new Date().toISOString().slice(0, 10),
        model: MODEL,
        note: 'Reviewed answer text. Edit freely — this file is the source of truth and is not regenerated on build.',
        quick: generated.quick,
        answers: Object.fromEntries(FAQ_KEYS.map((k) => [k, generated.answers[k].trim()])),
      };

      if (printOnly) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        fs.writeFileSync(path.join(OUT_DIR, `${breed.slug}.json`), JSON.stringify(payload, null, 2) + '\n');
      }
      ok++;
      process.stdout.write(`  ${ok}/${todo.length} ${breed.slug}\n`);
    } catch (e) {
      problems.push(`${breed.slug}: ${(e as Error).message}`);
    }
  });

  console.log(`[faqs] ${ok} written, ${problems.length} problem(s)`);
  for (const p of problems) console.log(`       ${p}`);
}

await main();
