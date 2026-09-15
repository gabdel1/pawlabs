/**
 * One-shot normaliser for CMS media filenames.
 *
 * Uploads arrived with names like "Belgian Malinois", " Chinese Crested" and
 * "Havanese-1.Havanese": raw spaces, leading whitespace, no extension. Those
 * make crawlers truncate the URL — Search Console was showing 404s for invented
 * variants such as /media/Belgian.
 *
 * This renames the bytes on disk (cms/media and public/media) and updates the
 * matching Payload rows, then writes an old -> new mapping that the redirect
 * generator consumes. File contents are never touched.
 *
 *   npx tsx scripts/normalize-media-filenames.ts            # dry run
 *   npx tsx scripts/normalize-media-filenames.ts --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRS = [path.join(ROOT, 'cms', 'media'), path.join(ROOT, 'public', 'media')];
const MAPPING_OUT = path.join(ROOT, '.cache', 'media-rename-map.tsv');
const APPLY = process.argv.includes('--apply');
const SEP = '<|>';

const DB_URL = (() => {
  const env = fs.readFileSync(path.join(ROOT, 'cms', '.env'), 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('DATABASE_URI='));
  if (!line) throw new Error('DATABASE_URI not found in cms/.env');
  return line.slice('DATABASE_URI='.length).trim();
})();

function psql(sql: string): string {
  return execFileSync('psql', [DB_URL, '-tA', '-c', sql], { encoding: 'utf8' });
}

const REAL_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const EXT_FOR_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Strip the extension, including Payload's duplicate artefact where the base
 * name is repeated as a fake extension ("Cane Corso-2.Cane Corso").
 */
function baseName(filename: string): string {
  const base = filename.trim();
  const real = base.match(REAL_EXT);
  if (real) return base.slice(0, -real[0].length);

  const dotted = base.match(/^(.*?)(-\d+)?\.(.+)$/);
  if (dotted && slugify(dotted[3]) === slugify(dotted[1])) {
    return dotted[1] + (dotted[2] ?? '');
  }
  return base;
}

interface Row { id: string; filename: string; mime: string; }

const rows: Row[] = psql(
  "select id || '" + SEP + "' || filename || '" + SEP + "' || coalesce(mime_type,'') " +
  'from media where filename is not null order by id',
)
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [id, filename, mime] = line.split(SEP);
    return { id, filename, mime };
  });

// Names carrying a -N duplicate marker are handled last, so an unsuffixed file
// keeps the clean slug and the duplicates fall back to keeping their number.
const ordered = [...rows].sort((a, b) => {
  const aDup = /-\d+$/.test(baseName(a.filename)) ? 1 : 0;
  const bDup = /-\d+$/.test(baseName(b.filename)) ? 1 : 0;
  return aDup - bDup || Number(a.id) - Number(b.id);
});

const taken = new Set<string>();
const mapping: { id: string; from: string; to: string }[] = [];
let unchanged = 0;

for (const row of ordered) {
  const ext =
    EXT_FOR_MIME[row.mime] ??
    (row.filename.match(REAL_EXT)?.[0].slice(1).toLowerCase() || 'bin');
  const base = baseName(row.filename);

  // Prefer dropping a -N marker when nothing else claims the clean name.
  const candidates = [slugify(base.replace(/-\d+$/, '')), slugify(base)].filter(Boolean);
  let chosen = '';
  for (const candidate of candidates) {
    const name = candidate + '.' + ext;
    if (!taken.has(name)) { chosen = name; break; }
  }
  if (!chosen) {
    const stem = candidates[candidates.length - 1] || 'media';
    for (let i = 2; !chosen; i++) {
      const name = stem + '-' + i + '.' + ext;
      if (!taken.has(name)) chosen = name;
    }
  }

  taken.add(chosen);
  if (chosen === row.filename) { unchanged++; continue; }
  mapping.push({ id: row.id, from: row.filename, to: chosen });
}

console.log(rows.length + ' media rows | ' + mapping.length + ' to rename | ' + unchanged + ' already clean\n');
for (const m of mapping) console.log('  [' + m.from + ']  ->  ' + m.to);

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to rename files and update the database.');
  process.exit(0);
}

// Rename on disk
let moved = 0;
let absent = 0;
for (const m of mapping) {
  for (const dir of DIRS) {
    const from = path.join(dir, m.from);
    const to = path.join(dir, m.to);
    if (!fs.existsSync(from)) { absent++; continue; }
    if (fs.existsSync(to)) { fs.rmSync(from); continue; }
    fs.renameSync(from, to);
    moved++;
  }
}

// Update the database in a single transaction
const esc = (v: string) => v.replace(/'/g, "''");
const statements = mapping
  .map((m) =>
    "update media set filename='" + esc(m.to) + "', url='/api/media/file/" + esc(m.to) +
    "' where id=" + Number(m.id) + ';')
  .join('\n');
execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-1', '-c', statements], { encoding: 'utf8' });

fs.mkdirSync(path.dirname(MAPPING_OUT), { recursive: true });
fs.writeFileSync(MAPPING_OUT, mapping.map((m) => m.from + '\t' + m.to).join('\n') + '\n');

console.log('\nRenamed ' + moved + ' files across ' + DIRS.length + ' directories (' + absent + ' not present on disk).');
console.log('Updated ' + mapping.length + ' database rows.');
console.log('Mapping written to ' + path.relative(ROOT, MAPPING_OUT));
