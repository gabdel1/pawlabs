/**
 * Render the branded share images for pages that have no photo of their own.
 *
 *   npx tsx scripts/generate-og-images.ts [--force]
 *
 * Breed profiles and comparison articles use their own photo as the share
 * image. Everything else — the homepage, the quiz, the hubs, the calculators,
 * the legal pages — had none, so links to them unfurled on social media as a
 * bare headline with a blank rectangle.
 *
 * These are drawn as SVG and rasterised with sharp, in the same visual
 * language as the /what-breed-is-my-dog card: dark teal ground, paw watermarks,
 * a headline, a supporting line, and a few outlined pills. They are cheap to
 * regenerate, so the wording lives here rather than in a pile of binaries
 * nobody can edit.
 *
 * Fonts: DejaVu Sans, which is what librsvg renders with on this box. Text is
 * wrapped and auto-sized here rather than by the renderer, because SVG has no
 * text wrapping of its own.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.resolve(process.cwd(), 'public/og');
const W = 1200;
const H = 630;
const PAD = 72;

const force = process.argv.includes('--force');

interface CardSpec {
  /** File name, without extension. Referenced as /og/<name>.png */
  name: string;
  badge: string;
  title: string;
  subtitle: string;
  pills: string[];
  /** Accent used for the badge and pills. */
  accent?: string;
}

const CARDS: CardSpec[] = [
  {
    name: 'home',
    badge: 'PAWLABS',
    title: 'Every dog breed,\nscored the same way',
    subtitle: 'So comparisons actually mean something.',
    pills: ['201 breeds', 'Free tools', 'No signup'],
  },
  {
    name: 'quiz',
    badge: 'BREED MATCH QUIZ',
    title: 'Which breed actually\nfits your life?',
    subtitle: 'Ten honest questions about your home, your week and your household.',
    pills: ['~2 minutes', '201 breeds', 'Free'],
    accent: '#FFB454',
  },
  {
    name: 'tools',
    badge: 'FREE CALCULATORS',
    title: 'Dog calculators that do\nthe arithmetic properly',
    subtitle: 'Age, puppy weight, feeding, toxicity and pregnancy — the formulas vets use.',
    pills: ['5 tools', 'Instant', 'Nothing stored'],
  },
  {
    name: 'breeds',
    badge: 'BREED ENCYCLOPEDIA',
    title: 'Every breed, rated on\nthe traits you live with',
    subtitle: 'Temperament, grooming, energy and health — scored, not described.',
    pills: ['201 profiles', '14 traits each'],
  },
  {
    name: 'compare',
    badge: 'COMPARE BREEDS',
    title: 'Put any two breeds\nside by side',
    subtitle: 'Shedding, energy, trainability and apartment life, scored out of 10.',
    pills: ['201 breeds', 'Instant table'],
  },
  {
    name: 'dog-age-calculator',
    badge: 'AGE CALCULATOR',
    title: 'How old is your dog,\nreally?',
    subtitle: 'The seven-year rule is wrong twice over. This one adjusts for size.',
    pills: ['By breed size', 'Free'],
  },
  {
    name: 'puppy-weight-calculator',
    badge: 'GROWTH PREDICTOR',
    title: 'How big will your\npuppy get?',
    subtitle: 'Predict adult weight from what your puppy weighs today.',
    pills: ['5 size classes', 'Honest margin'],
    accent: '#6FC8E8',
  },
  {
    name: 'dog-food-calculator',
    badge: 'FEEDING CALCULATOR',
    title: 'How much should\nyour dog eat?',
    subtitle: 'Daily calories from the veterinary formula, converted into cups.',
    pills: ['kcal, cups, meals', 'Free'],
    accent: '#F0B860',
  },
  {
    name: 'dog-chocolate-toxicity-calculator',
    badge: 'EMERGENCY CHECKER',
    title: 'Your dog ate chocolate.\nHow bad is it?',
    subtitle: 'Work out the dose from the type, the amount and your dog’s weight.',
    pills: ['Poison-line numbers', 'Grapes too'],
    accent: '#FF8A8A',
  },
  {
    name: 'dog-pregnancy-calculator',
    badge: 'WHELPING PLANNER',
    title: 'When are the\npuppies due?',
    subtitle: 'Due date, whelping window and the full week-by-week timeline.',
    pills: ['63-day gestation', 'Vet milestones'],
    accent: '#C9A3E0',
  },
  {
    name: 'default',
    badge: 'PAWLABS',
    title: 'A dog breed encyclopedia\nbuilt on real numbers',
    subtitle: 'Profiles, comparisons and calculators for people choosing or raising a dog.',
    pills: ['201 breeds', '14 traits each'],
  },
];

/** DejaVu Sans Bold is roughly 0.60em per character averaged over prose. */
function measure(text: string, size: number, bold = true): number {
  return text.length * size * (bold ? 0.6 : 0.54);
}

/** Wrap on word boundaries, honouring explicit newlines. */
function wrap(text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let current = '';
    for (const word of paragraph.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildSvg(spec: CardSpec): string {
  const accent = spec.accent ?? '#4ECDC4';
  const maxWidth = W - PAD * 2;

  // Shrink the headline until it fits in three lines.
  let titleSize = 72;
  let titleLines = wrap(spec.title, titleSize, maxWidth);
  while (titleLines.length > 3 && titleSize > 44) {
    titleSize -= 4;
    titleLines = wrap(spec.title, titleSize, maxWidth);
  }

  const subtitleSize = 30;
  const subtitleLines = wrap(spec.subtitle, subtitleSize, maxWidth).slice(0, 2);

  // Lay the block out from the vertical centre so short and long cards balance.
  const titleLead = titleSize * 1.16;
  const blockHeight = titleLines.length * titleLead + subtitleLines.length * 42 + 30;
  let y = Math.max(210, (H - blockHeight) / 2 + titleSize);

  const titleTspans = titleLines
    .map((line, i) => `<tspan x="${PAD}" dy="${i === 0 ? 0 : titleLead}">${escapeXml(line)}</tspan>`)
    .join('');

  const subtitleY = y + (titleLines.length - 1) * titleLead + 58;
  const subtitleTspans = subtitleLines
    .map((line, i) => `<tspan x="${PAD}" dy="${i === 0 ? 0 : 40}">${escapeXml(line)}</tspan>`)
    .join('');

  // Pills sit on a fixed baseline so every card lines up.
  let pillX = PAD;
  const pillY = H - 112;
  const pills = spec.pills
    .map((label) => {
      const textWidth = measure(label, 24);
      const width = textWidth + 46;
      const svg = `
    <rect x="${pillX}" y="${pillY}" width="${width}" height="46" rx="23" fill="none" stroke="${accent}" stroke-width="3"/>
    <text x="${pillX + width / 2}" y="${pillY + 31}" font-size="24" font-weight="bold" fill="#FFF8F0" text-anchor="middle">${escapeXml(label)}</text>`;
      pillX += width + 16;
      return svg;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#1B525C"/>
  <g fill="#276570">
    <circle cx="1083" cy="33" r="14"/><circle cx="1106" cy="14" r="14"/><circle cx="1133" cy="14" r="14"/><circle cx="1157" cy="33" r="14"/>
    <ellipse cx="1120" cy="78" rx="34" ry="28"/>
    <circle cx="1010" cy="470" r="18"/><circle cx="1040" cy="446" r="18"/><circle cx="1076" cy="446" r="18"/><circle cx="1106" cy="470" r="18"/>
    <ellipse cx="1058" cy="534" rx="44" ry="36"/>
    <circle cx="905" cy="182" r="10"/><circle cx="922" cy="168" r="10"/><circle cx="942" cy="168" r="10"/><circle cx="960" cy="182" r="10"/>
    <ellipse cx="932" cy="215" rx="25" ry="21"/>
  </g>
  <g font-family="DejaVu Sans">
    <text x="${PAD}" y="88" font-size="24" font-weight="bold" fill="${accent}" letter-spacing="2.5">${escapeXml(spec.badge)}</text>
    <text x="${PAD}" y="${y}" font-size="${titleSize}" font-weight="bold" fill="#FFF8F0">${titleTspans}</text>
    <text x="${PAD}" y="${subtitleY}" font-size="${subtitleSize}" fill="#BFE3DE">${subtitleTspans}</text>
    ${pills}
    <text x="${PAD}" y="${H - 38}" font-size="21" fill="${accent}">pawlabs.org</text>
  </g>
</svg>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  let skipped = 0;

  for (const spec of CARDS) {
    const file = path.join(OUT_DIR, `${spec.name}.png`);
    if (fs.existsSync(file) && !force) {
      skipped++;
      continue;
    }
    const info = await sharp(Buffer.from(buildSvg(spec))).png({ compressionLevel: 9 }).toFile(file);
    console.log(`  ${spec.name.padEnd(36)} ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
    written++;
  }

  console.log(`[og] ${written} written, ${skipped} already present${skipped && !force ? ' (--force to redo)' : ''}`);
}

await main();
