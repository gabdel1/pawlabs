/**
 * Build-time generator for quiz-result share cards.
 *
 * Produces one 1200x630 JPEG per breed at public/share/<slug>.jpg, used as the
 * og:image on /quiz/result/<slug>. Cards carry the breed photo, the breed name,
 * "My PawLabs match" and the domain, so a link pasted into a social feed reads
 * as a result rather than a bare URL.
 *
 * Text is rendered through librsvg (via sharp), which resolves fonts through
 * fontconfig. Rather than depend on the brand font being installed on whatever
 * machine runs the build, we ship Outfit in scripts/assets and point
 * fontconfig at it with a generated config — so cards look identical anywhere.
 *
 * Cards are skipped when the existing file is newer than both the source photo
 * and this script, which keeps the daily rebuild from redoing 200 composites.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FONT_DIR = path.join(ROOT, 'scripts', 'assets');
const FONT_FILE = path.join(FONT_DIR, 'Outfit.ttf');
const OUT_DIR = path.join(ROOT, 'public', 'share');
const MEDIA_DIR = path.join(ROOT, 'public', 'media');
const API = process.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api';

const WIDTH = 1200;
const HEIGHT = 630;
const PHOTO_W = 470;

/** Point fontconfig at the vendored font before sharp loads librsvg. */
function configureFonts(): string {
  if (!fs.existsSync(FONT_FILE)) {
    console.warn('[share-cards] Outfit.ttf missing — falling back to system fonts');
    return 'DejaVu Sans';
  }
  const confDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pawlabs-fonts-'));
  const cacheDir = path.join(confDir, 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(confDir, 'fonts.conf'),
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONT_DIR}</dir>
  <dir>/usr/share/fonts</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>`,
  );
  process.env.FONTCONFIG_FILE = path.join(confDir, 'fonts.conf');
  return 'Outfit';
}

const FONT_FAMILY = configureFonts();
const { default: sharp } = await import('sharp');

interface Breed {
  id: string;
  name: string;
  slug: string;
  image?: { filename?: string } | string | null;
  breedGroup?: string;
  size?: string;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Wrap a breed name to at most two lines, sizing down as it gets longer. */
function layoutName(name: string): { lines: string[]; size: number } {
  const words = name.split(/\s+/);
  const size = name.length > 26 ? 58 : name.length > 18 ? 68 : 82;
  if (name.length <= 16 || words.length === 1) return { lines: [name], size };

  // Split near the middle by character count, on a word boundary.
  let best = 1;
  let bestDelta = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    const delta = Math.abs(a - b);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return { lines: [words.slice(0, best).join(' '), words.slice(best).join(' ')], size };
}

/**
 * Background layer, composited beneath the photo.
 *
 * Kept separate from the text: a single full-canvas SVG would paint its opaque
 * background rect over the photo panel, since sharp composites layers in order.
 */
function buildBackgroundSvg(): Buffer {
  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1C614A"/>
      <stop offset="55%" stop-color="#18503E"/>
      <stop offset="100%" stop-color="#0A0F1A"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.1" cy="0.1" r="0.8">
      <stop offset="0%" stop-color="#3ABF8E" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#3ABF8E" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
</svg>`);
}

function buildSvg(breed: Breed, hasPhoto: boolean): Buffer {
  const { lines, size } = layoutName(breed.name);
  const textWidth = hasPhoto ? WIDTH - PHOTO_W - 130 : WIDTH - 160;
  const nameY = lines.length === 2 ? 300 : 330;

  const meta = [breed.size, breed.breedGroup]
    .filter(Boolean)
    .map((s) => String(s).replace(/-/g, ' '))
    .join('  ·  ');

  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- accent rule -->
  <rect x="80" y="152" width="64" height="6" rx="3" fill="#C2F030"/>

  <text x="80" y="132" font-family="${FONT_FAMILY}" font-size="26" font-weight="700"
        fill="#C2F030" letter-spacing="4">MY PAWLABS MATCH</text>

  ${lines
    .map(
      (line, i) =>
        `<text x="80" y="${nameY + i * (size + 10)}" font-family="${FONT_FAMILY}" font-size="${size}" font-weight="800" fill="#FFFFFF">${xmlEscape(line)}</text>`,
    )
    .join('\n  ')}

  ${
    meta
      ? `<text x="80" y="${nameY + lines.length * (size + 10) + 14}" font-family="${FONT_FAMILY}" font-size="27" font-weight="700" fill="#93EAC7" letter-spacing="1">${xmlEscape(meta.toUpperCase())}</text>`
      : ''
  }

  <text x="80" y="${HEIGHT - 108}" font-family="${FONT_FAMILY}" font-size="30" font-weight="700"
        fill="#FFFFFF" opacity="0.72" textLength="${Math.min(textWidth, 520)}" lengthAdjust="spacingAndGlyphs">Take the 2-minute breed quiz</text>

  <text x="80" y="${HEIGHT - 58}" font-family="${FONT_FAMILY}" font-size="34" font-weight="800"
        fill="#FFFFFF">pawlabs.org</text>
</svg>`);
}

/** Rounded-corner mask for the photo panel. */
function roundedMask(w: number, h: number, r: number): Buffer {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );
}

function resolvePhoto(breed: Breed): string | null {
  const image = breed.image;
  const filename = typeof image === 'object' && image ? image.filename : undefined;
  if (!filename) return null;
  const file = path.join(MEDIA_DIR, filename);
  return fs.existsSync(file) ? file : null;
}

async function fetchBreeds(): Promise<Breed[]> {
  const url = `${API}/breeds?where[status][equals]=published&limit=500&depth=1&sort=name`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Payload API ${res.status}`);
  const data = (await res.json()) as { docs: Breed[] };
  return data.docs;
}

/** Regenerate only when the card is older than its inputs. */
function isStale(out: string, photo: string | null): boolean {
  if (!fs.existsSync(out)) return true;
  const outTime = fs.statSync(out).mtimeMs;
  const scriptTime = fs.statSync(import.meta.filename).mtimeMs;
  if (scriptTime > outTime) return true;
  if (photo && fs.statSync(photo).mtimeMs > outTime) return true;
  return false;
}

async function renderCard(breed: Breed): Promise<'written' | 'skipped'> {
  const out = path.join(OUT_DIR, `${breed.slug}.jpg`);
  const photo = resolvePhoto(breed);
  if (!isStale(out, photo)) return 'skipped';

  // Order matters: background, then photo, then text on top.
  const layers: sharp.OverlayOptions[] = [{ input: buildBackgroundSvg(), top: 0, left: 0 }];

  if (photo) {
    const panel = await sharp(photo)
      .resize(PHOTO_W, HEIGHT - 120, { fit: 'cover', position: 'attention' })
      .composite([{ input: roundedMask(PHOTO_W, HEIGHT - 120, 36), blend: 'dest-in' }])
      .png()
      .toBuffer();
    layers.push({ input: panel, top: 60, left: WIDTH - PHOTO_W - 60 });
  }

  layers.push({ input: buildSvg(breed, Boolean(photo)), top: 0, left: 0 });

  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: '#0A0F1A' },
  })
    .composite(layers)
    .flatten({ background: '#0A0F1A' })
    .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(out);

  return 'written';
}

/** Generic card for the quiz landing page and any breed without its own. */
async function renderFallback(): Promise<void> {
  const out = path.join(OUT_DIR, 'default.jpg');
  if (!isStale(out, null)) return;
  await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 4, background: '#0A0F1A' } })
    .composite([
      { input: buildBackgroundSvg(), top: 0, left: 0 },
      {
        input: buildSvg(
          { id: '0', name: 'Find your breed', slug: 'default', breedGroup: '', size: '' },
          false,
        ),
        top: 0,
        left: 0,
      },
    ])
    .flatten({ background: '#0A0F1A' })
    .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(out);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let breeds: Breed[];
  try {
    breeds = await fetchBreeds();
  } catch (err) {
    // A CMS outage must not break the site build — result pages fall back to
    // the default card when a per-breed one is missing.
    console.warn(`[share-cards] Could not reach the CMS (${(err as Error).message}) — skipping`);
    await renderFallback().catch(() => {});
    return;
  }

  let written = 0;
  let skipped = 0;
  let failed = 0;

  for (const breed of breeds) {
    if (!breed.slug) continue;
    try {
      const result = await renderCard(breed);
      result === 'written' ? written++ : skipped++;
    } catch (err) {
      failed++;
      console.warn(`[share-cards] ${breed.slug}: ${(err as Error).message}`);
    }
  }

  await renderFallback();

  console.log(
    `[share-cards] ${written} written, ${skipped} up to date, ${failed} failed (${breeds.length} breeds)`,
  );
}

main().catch((err) => {
  console.error('[share-cards] Fatal:', err);
  process.exit(1);
});
