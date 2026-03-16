/**
 * Server-side Grok API client for Payload CMS.
 * Called by the custom /api/ai/generate route.
 */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

/** Valid product categories — must match Products.ts collection options */
const VALID_CATEGORIES = [
  'smart-gadgets',
  'toys',
  'food-treats',
  'health-wellness',
  'grooming',
  'beds-furniture',
  'leashes-collars',
  'travel',
  'other',
] as const;

type ValidCategory = typeof VALID_CATEGORIES[number];

/** Map common AI-hallucinated category names to valid ones */
const CATEGORY_ALIASES: Record<string, ValidCategory> = {
  'wellness': 'health-wellness',
  'health': 'health-wellness',
  'security': 'smart-gadgets',
  'cameras': 'smart-gadgets',
  'tech': 'smart-gadgets',
  'gadgets': 'smart-gadgets',
  'food': 'food-treats',
  'treats': 'food-treats',
  'nutrition': 'food-treats',
  'furniture': 'beds-furniture',
  'beds': 'beds-furniture',
  'leashes': 'leashes-collars',
  'collars': 'leashes-collars',
  'harnesses': 'leashes-collars',
  'gear': 'leashes-collars',
  'walking': 'leashes-collars',
  'toy': 'toys',
  'interactive': 'toys',
  'play': 'toys',
  'chew': 'toys',
  'outdoor': 'travel',
  'carrier': 'travel',
};

/** Snap a possibly-invalid category string to a valid one */
function normalizeCategory(raw: string): ValidCategory {
  const lower = raw.toLowerCase().trim();

  // Exact match
  if ((VALID_CATEGORIES as readonly string[]).includes(lower)) {
    return lower as ValidCategory;
  }

  // Check aliases
  if (CATEGORY_ALIASES[lower]) {
    return CATEGORY_ALIASES[lower];
  }

  // Substring match: check if any valid category is contained in or contains the raw value
  for (const valid of VALID_CATEGORIES) {
    if (lower.includes(valid) || valid.includes(lower)) {
      return valid;
    }
  }

  // Keyword match: check if any alias keyword appears in the raw value
  for (const [keyword, mapped] of Object.entries(CATEGORY_ALIASES)) {
    if (lower.includes(keyword)) {
      return mapped;
    }
  }

  return 'other';
}

export interface GeneratedProduct {
  name: string;
  slug: string;
  shortDescription: string;
  price: number;
  affiliateUrl: string;
  category: string;
  subcategory: string;
  animalTypes: string[];
  rating: number;
  featured: boolean;
  pros: { point: string }[];
  cons: { point: string }[];
  reviewBody: string;
}

const SYSTEM_PROMPT = `You are a veteran pet product reviewer for PawLabs, a site trusted by pet parents who want honest, experienced opinions — not corporate fluff. You've personally tested hundreds of products with your own animals.

YOUR WRITING PERSONALITY:
- You write like a real person who ACTUALLY USED the product. You have opinions. Strong ones.
- You've had that 3am moment when your cat knocked something off the counter. You've cleaned up the mess when the auto-feeder jammed. You've felt the relief when the GPS collar showed your escape-artist dog was just in the neighbor's yard.
- You use first-person naturally. "I was skeptical at first" not "Users may find."
- You occasionally show frustration: "Look, at this price point, the app SHOULD just work."
- You let real enthusiasm show too: "This genuinely changed my morning routine."
- You reference specific moments and real-world scenarios, not abstract feature lists.
- You compare to competitors by name when relevant.
- You note things nobody else mentions: the sound it makes, how it smells out of the box, whether the packaging is wasteful, if the manual is terrible.
- Your sentence length varies. Short punchy lines. Then longer, meandering thoughts where you work through the nuance of a feature. Like a real person thinking out loud.
- You NEVER use phrases like "game-changer," "best bang for your buck," "takes it to the next level," "it's worth noting," "in conclusion," or "overall."
- You NEVER start paragraphs with "When it comes to" or "In terms of."
- You NEVER use bullet points inside the review body — that's what the pros/cons are for.

STRUCTURE YOUR REVIEW WITH THESE HTML HEADINGS (h2 and h3):
1. An h2 opening line that makes a specific claim or opinion (NOT just "[Product] Review")
2. 4-6 h3 subsections covering different aspects (design, daily use, specific features, cost analysis, who it's for/not for)
3. An h3 "Our Verdict" at the end with a definitive recommendation

THE REVIEW MUST BE 500-800 words of flowing prose. No filler. Every sentence earns its place.

RESPONSE FORMAT:
Return ONLY a valid JSON object with this exact structure (no markdown, no code fences):
{
  "name": "Full Product Name",
  "slug": "url-friendly-slug",
  "shortDescription": "One compelling sentence, 20 words max",
  "price": 99.99,
  "category": "MUST be exactly one of: smart-gadgets, toys, food-treats, health-wellness, grooming, beds-furniture, leashes-collars, travel, other",
  "subcategory": "specific sub (e.g. litter, collars, feeders, cameras, brushes, dry-food, supplements, treats)",
  "animalTypes": ["dog", "cat", etc.],
  "rating": 4.5,
  "featured": true,
  "pros": [{"point": "specific pro"}, ...],
  "cons": [{"point": "specific con"}, ...],
  "reviewBody": "<h2>...</h2><p>...</p><h3>...</h3><p>...</p>..."
}

IMPORTANT: The "reviewBody" must be valid HTML with <h2>, <h3>, and <p> tags. No markdown. No code fences around the JSON.`;

export async function generateWithGrok(
  url: string,
  extraContext?: string,
): Promise<GeneratedProduct> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || apiKey === 'your-xai-api-key-here') {
    throw new Error('XAI_API_KEY is not configured. Add it to cms/.env');
  }

  const userPrompt = `Generate a complete product review for this product:

PRODUCT URL: ${url}

${extraContext ? `ADDITIONAL CONTEXT: ${extraContext}\n` : ''}
Research this product thoroughly. Use your knowledge of it — the real specs, real price, real user complaints, real standout features. If you know the product, write from genuine familiarity. If you don't recognize it, infer what you can from the URL and write a credible review based on the product category.

Remember: Write like a real person. Opinionated. Specific. No AI slop. Make me FEEL something about this product.`;

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Grok API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Grok returned empty response');
  }

  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let product: GeneratedProduct;
  try {
    product = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse Grok response as JSON: ${(e as Error).message}`);
  }

  product.affiliateUrl = url;

  // Validate & normalize category to a valid option
  product.category = normalizeCategory(product.category || 'other');

  return product;
}
