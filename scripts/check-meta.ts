/**
 * Constraint check for the generated SERP copy in src/lib/meta.ts.
 *
 * Titles must stay under 60 characters and descriptions inside 140-160 for
 * every breed and every comparison — a rule that is easy to satisfy for a short
 * breed name and easy to break for a long one, so it is checked in bulk rather
 * than spot-checked.
 *
 *   npx tsx scripts/check-meta.ts            # constraint report + 10 samples
 *   npx tsx scripts/check-meta.ts --all      # every row
 */
import type { Breed, Comparison } from '../src/lib/payload';

const API = process.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api';

async function fetchDocs<T>(collection: string, depth: number): Promise<T[]> {
  const url = `${API}/${collection}?where[status][equals]=published&limit=300&depth=${depth}&sort=name`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${collection}: ${res.status} ${res.statusText}`);
  return (await res.json()).docs as T[];
}

const getBreeds = () => fetchDocs<Breed>('breeds', 1);
const getComparisons = () => fetchDocs<Comparison>('comparisons', 2);
import {
  breedMetaTitle,
  breedMetaDescription,
  comparisonMetaTitle,
  comparisonDescription,
  familyRoundupFor,
} from '../src/lib/meta';
import { buildBreedFaqs } from '../src/lib/breed-faq';

/** Same shape the breed page builds: comparisons that reference this breed. */
const breedIdsOf = (c: Comparison) =>
  (c.breeds ?? []).map((b) => (typeof b === 'string' ? b : b?.id)).filter(Boolean).map(String);

const showAll = process.argv.includes('--all');

function stats(lengths: number[]) {
  const sorted = [...lengths].sort((a, b) => a - b);
  return `min ${sorted[0]}  median ${sorted[Math.floor(sorted.length / 2)]}  max ${sorted[sorted.length - 1]}`;
}

const breeds = await getBreeds();
const comparisons = await getComparisons();

// ── Breeds ────────────────────────────────────────────
const rows = breeds.map((b) => ({
  name: b.name,
  slug: b.slug,
  title: breedMetaTitle(b),
  desc: breedMetaDescription(b),
}));

const badTitles = rows.filter((r) => r.title.length >= 60);
const badDescs = rows.filter((r) => r.desc.length < 140 || r.desc.length > 160);

console.log(`\n${'='.repeat(78)}\n  BREEDS — ${rows.length} profiles\n${'='.repeat(78)}`);
console.log(`  title length   ${stats(rows.map((r) => r.title.length))}   (must be < 60)`);
console.log(`  desc length    ${stats(rows.map((r) => r.desc.length))}   (must be 140-160)`);
console.log(`  titles too long: ${badTitles.length}`);
console.log(`  descs out of range: ${badDescs.length}`);
for (const r of badDescs.slice(0, 15)) console.log(`     ${r.desc.length}  ${r.name}: ${r.desc}`);
for (const r of badTitles.slice(0, 15)) console.log(`     ${r.title.length}  ${r.title}`);

// ── Comparisons ───────────────────────────────────────
const cRows = comparisons.map((c) => {
  const linked = (c.breeds || []).filter((b) => typeof b !== 'string') as Breed[];
  return {
    slug: c.slug,
    title: comparisonMetaTitle(c),
    desc: comparisonDescription(c, linked),
    n: linked.length,
  };
});
const badC = cRows.filter((r) => r.desc.length < 140 || r.desc.length > 160);

console.log(`\n${'='.repeat(78)}\n  COMPARISONS — ${cRows.length} articles\n${'='.repeat(78)}`);
console.log(`  desc length    ${stats(cRows.map((r) => r.desc.length))}   (must be 140-160)`);
console.log(`  descs out of range: ${badC.length}`);
for (const r of badC.slice(0, 15)) console.log(`     ${r.desc.length}  [${r.n}] ${r.slug}\n        ${r.desc}`);

// ── Samples ───────────────────────────────────────────
const pick = showAll ? rows : [...rows].sort(() => Math.random() - 0.5).slice(0, 10);
console.log(`\n${'='.repeat(78)}\n  ${showAll ? 'ALL' : '10 RANDOM'} BREED SAMPLES\n${'='.repeat(78)}`);
for (const r of pick) {
  console.log(`\n/breeds/${r.slug}`);
  console.log(`  T(${String(r.title.length).padStart(2)})  ${r.title}`);
  console.log(`  D(${r.desc.length})  ${r.desc}`);
}

const cPick = showAll ? cRows : [...cRows].sort(() => Math.random() - 0.5).slice(0, 6);
console.log(`\n${'='.repeat(78)}\n  ${showAll ? 'ALL' : '6 RANDOM'} COMPARISON SAMPLES\n${'='.repeat(78)}`);
for (const r of cPick) {
  console.log(`\n/compare/${r.slug}`);
  console.log(`  T(${String(r.title.length).padStart(2)})  ${r.title}`);
  console.log(`  D(${r.desc.length})  ${r.desc}`);
}
console.log();

// ── Internal links from the children FAQ ──────────────
console.log(`\n${'='.repeat(78)}\n  "GOOD WITH CHILDREN" FAQ LINKS\n${'='.repeat(78)}`);
let linked = 0;
const linkRows: string[] = [];
for (const b of breeds) {
  const featuredIn = comparisons.filter((c) => breedIdsOf(c).includes(String(b.id)));
  const roundup = familyRoundupFor(b, featuredIn);
  if (!roundup) continue;
  linked++;

  // The JSON-LD answer must match the rendered text exactly once tags are gone.
  const faq = buildBreedFaqs(b, { familyRoundup: roundup }).find((f) =>
    f.question.includes('good with children'),
  );
  const rendered = (faq?.answerHtml ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  const ok = rendered === faq?.answer;
  if (!ok) console.log(`  MISMATCH  ${b.name}\n    plain: ${faq?.answer}\n    html : ${rendered}`);

  linkRows.push(
    `  ${b.name.padEnd(30)} #${roundup.position ?? '-'}/${roundup.total}  /compare/${roundup.slug}`,
  );
}
console.log(`  breeds with a children-FAQ link: ${linked} of ${breeds.length}`);
const SIX = ['Beagle', 'Bernese Mountain Dog', 'Collie', 'Golden Retriever', 'Icelandic Sheepdog', 'Labrador Retriever'];
console.log('\n  The six ranked in the toddlers article:');
for (const name of SIX) {
  const row = linkRows.find((r) => r.trim().startsWith(name));
  console.log(row ?? `  ${name.padEnd(30)} NO LINK`);
}
if (showAll) {
  console.log('\n  All linked breeds:');
  for (const r of linkRows) console.log(r);
}
console.log();
