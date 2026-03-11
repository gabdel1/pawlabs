#!/usr/bin/env npx tsx
/**
 * CLI: Generate a product review from an affiliate link using Grok AI.
 *
 * Usage:
 *   npx tsx scripts/generate-review.ts <affiliate-url> [--context "extra info"] [--save]
 *
 * Examples:
 *   npx tsx scripts/generate-review.ts "https://amazon.com/dp/B0BFH9XKGL?tag=pawlabs-20"
 *   npx tsx scripts/generate-review.ts "https://amazon.com/dp/B0BFH9XKGL" --context "self-cleaning litter box for cats" --save
 *
 * Flags:
 *   --context "..."  Extra context about the product (helps Grok write a better review)
 *   --save           Save to Payload CMS (requires CMS_EMAIL and CMS_PASSWORD env vars)
 *   --dry-run        Generate but only print, don't save (default)
 *
 * Environment:
 *   XAI_API_KEY      Required. Your xAI API key.
 *   CMS_EMAIL        Optional. Payload CMS admin email (for --save).
 *   CMS_PASSWORD     Optional. Payload CMS admin password (for --save).
 */

import { generateReview, saveToPayload, loginToPayload } from './grok-review';
import type { GeneratedProduct } from './grok-review';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── Parse Args ────────────────────────────────────────
const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--'));
const extraContext = args.includes('--context')
  ? args[args.indexOf('--context') + 1]
  : undefined;
const shouldSave = args.includes('--save');

if (!url) {
  console.error(`
  ╔══════════════════════════════════════════════════════════╗
  ║  PawLabs AI Review Generator (powered by Grok)          ║
  ╠══════════════════════════════════════════════════════════╣
  ║                                                          ║
  ║  Usage:                                                  ║
  ║    npx tsx scripts/generate-review.ts <url> [options]     ║
  ║                                                          ║
  ║  Options:                                                ║
  ║    --context "..."  Extra product context                 ║
  ║    --save           Save to CMS                          ║
  ║                                                          ║
  ║  Example:                                                ║
  ║    npx tsx scripts/generate-review.ts \\                   ║
  ║      "https://amazon.com/dp/B0BFH9XKGL?tag=pawlabs-20"  ║
  ║      --context "self-cleaning cat litter box"             ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
  `);
  process.exit(1);
}

// ── Load API Key ──────────────────────────────────────
const apiKey = process.env.XAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing XAI_API_KEY environment variable.');
  console.error('   Get your key at https://console.x.ai/');
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────
async function main() {
  console.log('🐾 PawLabs AI Review Generator');
  console.log('─'.repeat(50));
  console.log(`📎 URL: ${url}`);
  if (extraContext) console.log(`💡 Context: ${extraContext}`);
  console.log(`🤖 Model: grok-3`);
  console.log('');
  console.log('⏳ Generating review...');
  console.log('');

  const product = await generateReview(url!, { apiKey }, extraContext);

  // ── Print Result ────────────────────────────────────
  console.log('✅ Review generated!');
  console.log('─'.repeat(50));
  console.log(`📦 Product: ${product.name}`);
  console.log(`🔗 Slug: ${product.slug}`);
  console.log(`💰 Price: $${product.price}`);
  console.log(`⭐ Rating: ${product.rating}/5`);
  console.log(`📂 Category: ${product.category} > ${product.subcategory}`);
  console.log(`🐾 Animals: ${product.animalTypes.join(', ')}`);
  console.log(`⭐ Featured: ${product.featured ? 'Yes' : 'No'}`);
  console.log('');
  console.log(`✓ Pros (${product.pros.length}):`);
  product.pros.forEach(p => console.log(`  + ${p.point}`));
  console.log(`✗ Cons (${product.cons.length}):`);
  product.cons.forEach(c => console.log(`  − ${c.point}`));
  console.log('');

  // ── Preview review body (first 300 chars) ───────────
  const plainText = product.reviewBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`📝 Review preview (${plainText.length} chars):`);
  console.log(`   "${plainText.substring(0, 200)}..."`);
  console.log('');

  // ── Append to seed data file ────────────────────────
  const seedPath = resolve(__dirname, '../src/data/products.ts');
  console.log(`💾 Saving to seed data file...`);

  const seedEntry = formatSeedEntry(product);
  console.log(`   Generated seed entry for: ${product.name}`);

  // Write to a separate generated file
  const generatedPath = resolve(__dirname, '../src/data/generated-reviews.json');
  let existing: GeneratedProduct[] = [];
  if (existsSync(generatedPath)) {
    existing = JSON.parse(readFileSync(generatedPath, 'utf-8'));
  }

  // Check for duplicates by slug
  const dupeIndex = existing.findIndex(p => p.slug === product.slug);
  if (dupeIndex >= 0) {
    existing[dupeIndex] = product;
    console.log(`   ⚠ Updated existing entry for slug "${product.slug}"`);
  } else {
    existing.push(product);
    console.log(`   ✅ Added new entry (total: ${existing.length})`);
  }

  writeFileSync(generatedPath, JSON.stringify(existing, null, 2));
  console.log(`   📁 Saved to: ${generatedPath}`);
  console.log('');

  // ── Save to CMS ────────────────────────────────────
  if (shouldSave) {
    const email = process.env.CMS_EMAIL;
    const password = process.env.CMS_PASSWORD;

    if (!email || !password) {
      console.error('❌ --save requires CMS_EMAIL and CMS_PASSWORD env vars');
      process.exit(1);
    }

    console.log('🔐 Logging in to CMS...');
    const token = await loginToPayload(email, password);
    console.log('✅ Logged in');

    console.log('💾 Saving to CMS...');
    const result = await saveToPayload(product, undefined, token);
    console.log(`✅ Saved! ID: ${result.id}, Slug: ${result.slug}`);
  }

  console.log('─'.repeat(50));
  console.log('🎉 Done! To add this review to your site:');
  console.log(`   1. Review the generated JSON at: src/data/generated-reviews.json`);
  console.log(`   2. Import in src/data/products.ts if happy`);
  console.log(`   3. Run: npm run build`);
  console.log('');
}

function formatSeedEntry(product: GeneratedProduct): string {
  return `  {
    id: 'prod-gen-${Date.now()}',
    name: ${JSON.stringify(product.name)},
    slug: ${JSON.stringify(product.slug)},
    shortDescription: ${JSON.stringify(product.shortDescription)},
    price: ${product.price},
    affiliateUrl: ${JSON.stringify(product.affiliateUrl)},
    category: ${JSON.stringify(product.category)},
    subcategory: ${JSON.stringify(product.subcategory)},
    petType: ${JSON.stringify(product.animalTypes[0] ?? 'universal')},
    animalTypes: ${JSON.stringify(product.animalTypes)},
    featured: ${product.featured},
    rating: ${product.rating},
    pros: ${JSON.stringify(product.pros, null, 6).replace(/\n/g, '\n    ')},
    cons: ${JSON.stringify(product.cons, null, 6).replace(/\n/g, '\n    ')},
    reviewBody: ${JSON.stringify(product.reviewBody)},
    createdAt: '${new Date().toISOString()}',
    updatedAt: '${new Date().toISOString()}',
  }`;
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
