/**
 * Find boilerplate repeated across breed pages.
 *
 *   npx tsx scripts/check-faq-duplication.ts [--max=2] [--words=8] [--verbose]
 *
 * Reads the BUILT pages rather than the source data, so it measures what a
 * reader — or a reviewer sampling half a dozen pages — actually sees. It looks
 * inside the Quick answers box and the FAQ section only, since that is where
 * the templated sentences used to live.
 *
 * Target: zero sentences of 8+ words appearing on more than two breed pages.
 * The old template put the same sentence on all 201.
 *
 * Exits non-zero when the target is missed, so it can gate a deploy.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (n: string) => Number(args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1]);
const MAX_PAGES = arg('max') || 2;
const MIN_WORDS = arg('words') || 8;
const verbose = args.includes('--verbose');

const DIST = path.resolve(process.cwd(), 'dist/breeds');

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#8217;|&rsquo;/g, '’').replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();

/** The FAQ section and the Quick answers box, as rendered. */
function extractRegions(html: string): string {
  const regions: string[] = [];

  const faq = html.indexOf('id="faq"');
  if (faq >= 0) {
    const end = html.indexOf('</section>', faq);
    regions.push(html.slice(faq, end > 0 ? end : faq + 20000));
  }

  const quick = html.indexOf('class="quick-answers"');
  if (quick >= 0) {
    const end = html.indexOf('</dl>', quick);
    regions.push(html.slice(quick, end > 0 ? end : quick + 4000));
  }

  return decode(regions.join(' '));
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/^[^A-Za-z0-9(]+/, ''))
    .filter((s) => s.split(/\s+/).length >= MIN_WORDS);
}

const pages = fs.existsSync(DIST)
  ? fs.readdirSync(DIST).filter((d) => fs.existsSync(path.join(DIST, d, 'index.html')))
  : [];

if (!pages.length) {
  console.error('no built breed pages in dist/breeds — run a build first');
  process.exit(1);
}

const seen = new Map<string, string[]>();
let written = 0;

for (const slug of pages) {
  const html = fs.readFileSync(path.join(DIST, slug, 'index.html'), 'utf-8');
  if (fs.existsSync(path.resolve(process.cwd(), 'src/data/faqs', `${slug}.json`))) written++;

  for (const sentence of new Set(sentences(extractRegions(html)))) {
    if (!seen.has(sentence)) seen.set(sentence, []);
    seen.get(sentence)!.push(slug);
  }
}

const repeated = [...seen.entries()]
  .filter(([, slugs]) => slugs.length > MAX_PAGES)
  .sort((a, b) => b[1].length - a[1].length);

console.log(
  `\nScanned ${pages.length} breed pages (${written} with written answers, ${pages.length - written} still on the old template).`,
);
console.log(`Looking for sentences of ${MIN_WORDS}+ words appearing on more than ${MAX_PAGES} pages.\n`);

if (!repeated.length) {
  console.log('  none — no repeated boilerplate found\n');
}

if (repeated.length) console.log(`  ${repeated.length} repeated sentence(s):\n`);
for (const [sentence, slugs] of repeated.slice(0, verbose ? repeated.length : 25)) {
  console.log(`  ${String(slugs.length).padStart(3)} pages  "${sentence.slice(0, 104)}${sentence.length > 104 ? '…' : ''}"`);
  if (verbose) console.log(`            ${slugs.slice(0, 8).join(', ')}${slugs.length > 8 ? ', …' : ''}`);
}
if (!verbose && repeated.length > 25) console.log(`\n  … and ${repeated.length - 25} more (--verbose)`);

// Only the written pages are in scope; template pages are known-duplicated and
// are being replaced breed by breed.
const writtenSlugs = new Set(
  fs.readdirSync(path.resolve(process.cwd(), 'src/data/faqs')).map((f) => f.replace(/\.json$/, '')),
);
const amongWritten = repeated.filter(([, slugs]) => slugs.filter((s) => writtenSlugs.has(s)).length > MAX_PAGES);

console.log(
  `\n  Among pages with written answers: ${amongWritten.length} repeated sentence(s)` +
    `${amongWritten.length ? ' — these are the ones that matter' : ' — target met'}\n`,
);
for (const [sentence, slugs] of amongWritten.slice(0, 15)) {
  const hits = slugs.filter((s) => writtenSlugs.has(s));
  console.log(`  ${String(hits.length).padStart(3)} pages  "${sentence.slice(0, 96)}"`);
  console.log(`            ${hits.join(', ')}`);
}

// ── Answer-quality checks on the written files ──────────────────────
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

const dataDir = path.resolve(process.cwd(), 'src/data/faqs');
const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
const answerProblems: string[] = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8'));
  const stem = breedStem(String(data.breed));

  for (const [key, answer] of Object.entries(data.answers as Record<string, string>)) {
    const first = answer.split(/(?<=[.!?])\s/)[0] ?? answer;
    if (!stem.test(first)) {
      answerProblems.push(`${data.slug}/${key}: first sentence does not name the breed`);
    }
    if (/^(at|with|scoring|rated|scored)\s/i.test(first.trim())) {
      answerProblems.push(`${data.slug}/${key}: opens with a score`);
    }
    const words = answer.trim().split(/\s+/).length;
    if (words < 40 || words > 80) answerProblems.push(`${data.slug}/${key}: ${words} words`);
  }
  if (Object.keys(data.answers).length !== 11) {
    answerProblems.push(`${data.slug}: ${Object.keys(data.answers).length} answers, expected 11`);
  }
}

console.log(`  Answer checks across ${files.length} written file(s): ${answerProblems.length || 'all pass'}`);
for (const p of answerProblems.slice(0, 20)) console.log(`    ${p}`);
if (answerProblems.length > 20) console.log(`    … and ${answerProblems.length - 20} more`);
console.log();

process.exit(amongWritten.length === 0 && answerProblems.length === 0 ? 0 : 1);
