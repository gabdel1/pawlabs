/**
 * Render a 1200x630 share card for every breed that has a photo.
 *
 *   npx tsx scripts/generate-breed-og-cards.ts [--force] [--only=beagle]
 *
 * Breed profiles used their square 2048x2048 photo directly as og:image.
 * Facebook, LinkedIn and X render previews as a wide rectangle, so they crop a
 * square hard — taking the top and bottom off the dog, which on a portrait of
 * a standing animal is most of it.
 *
 * Rather than crop, these cards place the whole square photo beside a branded
 * panel carrying the breed name and its headline facts. Nothing is cut off,
 * the preview says which breed it is even at thumbnail size, and the output is
 * the 1.91:1 ratio every platform actually wants.
 *
 * Output: public/og/breeds/<slug>.jpg, JPEG because these are photographic —
 * the same reason the quiz share cards are JPEG. Skips breeds with no photo;
 * those fall back to the generic card via the layout.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const API = process.env.PAYLOAD_API_URL || 'http://127.0.0.1:3000/api';
const MEDIA_DIR = path.resolve(process.cwd(), 'public/media');
const OUT_DIR = path.resolve(process.cwd(), 'public/og/breeds');

const W = 1200;
const H = 630;
/** The photo is square, so it is exactly as wide as the card is tall. */
const PHOTO = H;
const PANEL_W = W - PHOTO;
const PAD = 56;

const force = process.argv.includes('--force');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);

const GROUP_LABELS: Record<string, string> = {
  sporting: 'Sporting', working: 'Working', herding: 'Herding', toy: 'Toy',
  terrier: 'Terrier', hound: 'Hound', 'non-sporting': 'Non-Sporting',
  'foundation-stock': 'Foundation Stock', natural: 'Natural', hybrid: 'Hybrid',
  mutation: 'Mutation', crossbreed: 'Crossbreed',
};

const SIZE_LABELS: Record<string, string> = {
  small: 'Small', medium: 'Medium', large: 'Large', giant: 'Giant',
};

function measure(text: string, size: number, bold = true): number {
  return text.length * size * (bold ? 0.6 : 0.54);
}

function wrap(text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Breed {
  name: string;
  slug: string;
  breedGroup?: string;
  size?: string;
  weightMin?: number;
  weightMax?: number;
  lifeExpectancyMin?: number;
  lifeExpectancyMax?: number;
  image?: { filename?: string };
}

function panelSvg(breed: Breed): string {
  const maxWidth = PANEL_W - PAD * 2;

  // Breed names run from "Pug" to "Nova Scotia Duck Tolling Retriever", so the
  // name is sized to fit rather than set at a fixed size.
  let nameSize = 58;
  let nameLines = wrap(breed.name, nameSize, maxWidth);
  while (nameLines.length > 3 && nameSize > 30) {
    nameSize -= 3;
    nameLines = wrap(breed.name, nameSize, maxWidth);
  }

  const lead = nameSize * 1.12;
  const nameStart = 246 - (nameLines.length - 1) * lead * 0.5;
  const nameTspans = nameLines
    .map((line, i) => `<tspan x="${PAD}" dy="${i === 0 ? 0 : lead}">${escapeXml(line)}</tspan>`)
    .join('');

  const facts: string[] = [];
  if (breed.breedGroup) facts.push(`${GROUP_LABELS[breed.breedGroup] ?? breed.breedGroup} group`);
  if (breed.size) facts.push(`${SIZE_LABELS[breed.size] ?? breed.size} breed`);
  if (breed.weightMin && breed.weightMax) facts.push(`${breed.weightMin}–${breed.weightMax} lb`);
  if (breed.lifeExpectancyMin && breed.lifeExpectancyMax) {
    facts.push(`${breed.lifeExpectancyMin}–${breed.lifeExpectancyMax} year lifespan`);
  }

  const factsY = nameStart + (nameLines.length - 1) * lead + 62;
  const factLines = facts
    .map((fact, i) => `<tspan x="${PAD}" dy="${i === 0 ? 0 : 38}">${escapeXml(fact)}</tspan>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#1B525C"/>
  <g fill="#276570">
    <circle cx="452" cy="86" r="11"/><circle cx="471" cy="70" r="11"/><circle cx="493" cy="70" r="11"/><circle cx="512" cy="86" r="11"/>
    <ellipse cx="482" cy="122" rx="27" ry="23"/>
    <circle cx="86" cy="556" r="9"/><circle cx="102" cy="543" r="9"/><circle cx="120" cy="543" r="9"/><circle cx="136" cy="556" r="9"/>
    <ellipse cx="111" cy="586" rx="22" ry="18"/>
  </g>
  <g font-family="DejaVu Sans">
    <text x="${PAD}" y="86" font-size="21" font-weight="bold" fill="#4ECDC4" letter-spacing="2.2">BREED PROFILE</text>
    <text x="${PAD}" y="${nameStart}" font-size="${nameSize}" font-weight="bold" fill="#FFF8F0">${nameTspans}</text>
    <text x="${PAD}" y="${factsY}" font-size="26" fill="#BFE3DE">${factLines}</text>
    <text x="${PAD}" y="${H - 40}" font-size="20" fill="#4ECDC4">pawlabs.org</text>
  </g>
</svg>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const res = await fetch(`${API}/breeds?where[status][equals]=published&limit=500&depth=1&sort=name`);
  if (!res.ok) throw new Error(`breeds: ${res.status} ${res.statusText}`);
  let breeds = (await res.json()).docs as Breed[];
  if (only) breeds = breeds.filter((b) => b.slug === only);

  let written = 0;
  let skipped = 0;
  let noPhoto = 0;
  let bytes = 0;

  for (const breed of breeds) {
    const filename = breed.image?.filename;
    const source = filename ? path.join(MEDIA_DIR, filename) : null;
    if (!source || !fs.existsSync(source)) {
      noPhoto++;
      continue;
    }

    const out = path.join(OUT_DIR, `${breed.slug}.jpg`);
    if (fs.existsSync(out) && !force) {
      skipped++;
      continue;
    }

    // The photo keeps its full square; only the panel is composited over the
    // background, so no part of the dog is ever cut off.
    const photo = await sharp(source)
      .resize(PHOTO, PHOTO, { fit: 'cover', position: 'centre' })
      .toBuffer();

    const info = await sharp(Buffer.from(panelSvg(breed)))
      .composite([{ input: photo, left: W - PHOTO, top: 0 }])
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(out);

    bytes += info.size;
    written++;
  }

  console.log(
    `[breed-og] ${written} written${written ? ` (avg ${Math.round(bytes / written / 1024)} KB)` : ''}, ` +
      `${skipped} already present${skipped && !force ? ' (--force to redo)' : ''}, ${noPhoto} breeds have no photo`,
  );
}

await main();
