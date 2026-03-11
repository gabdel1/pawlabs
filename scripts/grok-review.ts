/**
 * Grok AI Review Generator
 * 
 * Uses xAI's Grok-3 model to generate detailed, human-sounding product reviews
 * from an affiliate link. The review is structured as a complete product entry
 * ready to be saved to the CMS or seed data.
 */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

interface GrokConfig {
  apiKey: string;
  model?: string;
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
  "category": "one of: wellness, security, smart-gadgets, food-treats, grooming, beds-furniture, travel",
  "subcategory": "specific sub (e.g. litter, collars, feeders, cameras, brushes, dry-food, supplements, treats)",
  "animalTypes": ["dog", "cat", etc.],
  "rating": 4.5,
  "featured": true,
  "pros": [{"point": "specific pro"}, ...],
  "cons": [{"point": "specific con"}, ...],
  "reviewBody": "<h2>...</h2><p>...</p><h3>...</h3><p>...</p>..."
}

IMPORTANT: The "reviewBody" must be valid HTML with <h2>, <h3>, and <p> tags. No markdown. No code fences around the JSON.`;

const USER_PROMPT_TEMPLATE = (url: string, extraContext?: string) => `
Generate a complete product review for this product:

PRODUCT URL: ${url}

${extraContext ? `ADDITIONAL CONTEXT: ${extraContext}\n` : ''}
Research this product thoroughly. Use your knowledge of it — the real specs, real price, real user complaints, real standout features. If you know the product, write from genuine familiarity. If you don't recognize it, infer what you can from the URL and write a credible review based on the product category.

Remember: Write like a real person. Opinionated. Specific. No AI slop. Make me FEEL something about this product.`;

export async function generateReview(
  url: string,
  config: GrokConfig,
  extraContext?: string,
): Promise<GeneratedProduct> {
  const { apiKey, model = 'grok-3' } = config;

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT_TEMPLATE(url, extraContext) },
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

  // Parse JSON — handle potential markdown code fences
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let product: GeneratedProduct;
  try {
    product = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse Grok response as JSON:');
    console.error(jsonStr.substring(0, 500));
    throw new Error(`Invalid JSON from Grok: ${(e as Error).message}`);
  }

  // Add the affiliate URL
  product.affiliateUrl = url;

  // Validate required fields
  const required = ['name', 'slug', 'shortDescription', 'category', 'reviewBody'];
  for (const field of required) {
    if (!(product as any)[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return product;
}

/**
 * Save a generated product to the Payload CMS via REST API.
 */
export async function saveToPayload(
  product: GeneratedProduct,
  payloadUrl = 'http://127.0.0.1:3000/api',
  token?: string,
): Promise<{ id: string; slug: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `JWT ${token}`;
  }

  const payload = {
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    price: product.price,
    affiliateUrl: product.affiliateUrl,
    category: product.category,
    subcategory: product.subcategory,
    petType: product.animalTypes?.[0] ?? 'universal',
    featured: product.featured ?? false,
    rating: product.rating,
    pros: product.pros,
    cons: product.cons,
  };

  const response = await fetch(`${payloadUrl}/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Payload API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return { id: data.doc.id, slug: product.slug };
}

/**
 * Login to Payload CMS and get a JWT token.
 */
export async function loginToPayload(
  email: string,
  password: string,
  payloadUrl = 'http://127.0.0.1:3000/api',
): Promise<string> {
  const response = await fetch(`${payloadUrl}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}
