/**
 * Server-side Grok API client for generating multi-product guides.
 * Called by the /api/ai/guide route.
 */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

export interface ProductForGuide {
  id: string;
  name: string;
  slug: string;
  price?: number;
  category?: string;
  petType?: string;
  rating?: number;
  shortDescription?: string;
  affiliateUrl?: string;
  pros?: { point: string }[];
  cons?: { point: string }[];
}

export interface GeneratedGuide {
  title: string;
  slug: string;
  guideType: string;
  summary: string;
  content: string;
  category: string;
  petType: string;
}

const GUIDE_SYSTEM_PROMPT = `You are a veteran pet product reviewer for PawLabs. You're writing a comprehensive multi-product guide article.

YOUR TASK: Analyze the products provided and write a full guide article. You must DECIDE the best format:

IF ALL PRODUCTS SHARE THE SAME CATEGORY:
→ Write an "Ultimate Guide" (e.g., "The Ultimate Guide to Self-Cleaning Litter Boxes in 2026")
→ guideType: "ultimate-guide"

IF PRODUCTS ARE COMPLEMENTARY / MIXED CATEGORIES:
→ Write an "Essentials Roundup" (e.g., "7 Essential Products Every Cat Parent Needs in 2026")
→ guideType: "essentials"

IF 2-3 VERY SIMILAR PRODUCTS:
→ Write a "Comparison Guide" (e.g., "FURminator vs Maxpower Planet: Which Deshedding Tool Actually Works?")
→ guideType: "comparison"

OTHERWISE:
→ Write a "Product Roundup" (e.g., "Best Pet Tech Gear We Tested This Month")
→ guideType: "roundup"

YOUR WRITING PERSONALITY:
- Write like a real person who ACTUALLY USED these products. You have opinions. Strong ones.
- You've had that 3am moment. You've dealt with the mess. You know which products ACTUALLY work.
- Use first-person naturally. "I was skeptical at first" not "Users may find."
- Let real enthusiasm and frustration show.
- Compare products directly — don't treat each one in isolation.
- Highlight trade-offs honestly: "If budget matters more than features, go with X. But if you can afford it, Y is worth every penny."
- NEVER use cliché phrases like "game-changer," "takes it to the next level," "bang for your buck."
- NEVER start paragraphs with "When it comes to" or "In terms of."

PRODUCT LINKS:
When mentioning a product, link to it using this EXACT format:
<a href="{{PRODUCT:product-slug-here}}" class="guide-product-link">Product Name</a>

Use the exact slug provided for each product. The backend will replace {{PRODUCT:slug}} with the real affiliate URL.
Include price callouts naturally: "At $X, the <a href="{{PRODUCT:slug}}" class="guide-product-link">Name</a> is..."

STRUCTURE WITH HTML:
- <h2> for the main title/intro hook
- <h3> for each major section
- <p> for prose paragraphs
- <strong> for emphasis
- Use the product link format above for ALL product mentions
- Include a "The Bottom Line" or "Final Verdict" section at the end

THE GUIDE MUST BE 800-1500 words of flowing prose. Every sentence earns its place.

RESPONSE FORMAT:
Return ONLY a valid JSON object (no markdown, no code fences):
{
  "title": "Compelling Article Title",
  "slug": "url-friendly-slug",
  "guideType": "ultimate-guide | essentials | roundup | comparison",
  "summary": "One compelling sentence for SEO, 25 words max",
  "content": "<h2>...</h2><p>...</p><h3>...</h3><p>...</p>...",
  "category": "the primary category or 'mixed' if multiple",
  "petType": "dog | cat | universal | etc."
}

IMPORTANT: The "content" must be valid HTML with <h2>, <h3>, <p>, <strong>, and <a> tags. No markdown.`;

export async function generateGuideWithGrok(
  products: ProductForGuide[],
  extraContext?: string,
): Promise<GeneratedGuide> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || apiKey === 'your-xai-api-key-here') {
    throw new Error('XAI_API_KEY is not configured. Add it to cms/.env');
  }

  const productDescriptions = products.map((p, i) => {
    const pros = p.pros?.map(pr => pr.point).join(', ') || 'None listed';
    const cons = p.cons?.map(c => c.point).join(', ') || 'None listed';
    return `
PRODUCT ${i + 1}: ${p.name}
  Slug: ${p.slug}
  Price: ${p.price != null ? '$' + p.price.toFixed(2) : 'Unknown'}
  Category: ${p.category || 'Unknown'}
  Pet Type: ${p.petType || 'Universal'}
  Rating: ${p.rating != null ? p.rating + '/5' : 'Unrated'}
  Short Description: ${p.shortDescription || 'None'}
  Pros: ${pros}
  Cons: ${cons}`;
  }).join('\n');

  const userPrompt = `Write a comprehensive guide article featuring these ${products.length} products:
${productDescriptions}

${extraContext ? `ADDITIONAL CONTEXT: ${extraContext}\n` : ''}
Decide the best format based on the products. Link to every product using the {{PRODUCT:slug}} format. Be opinionated. Make real recommendations. No AI slop.`;

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [
        { role: 'system', content: GUIDE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 8192,
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

  let guide: GeneratedGuide;
  try {
    guide = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse Grok response as JSON: ${(e as Error).message}`);
  }

  return guide;
}

/**
 * Replace {{PRODUCT:slug}} placeholders with actual affiliate URLs.
 */
export function injectAffiliateLinks(
  html: string,
  products: ProductForGuide[],
): string {
  let result = html;
  for (const product of products) {
    const placeholder = `{{PRODUCT:${product.slug}}}`;
    const url = product.affiliateUrl || `/products/${product.slug}`;
    result = result.replaceAll(placeholder, url);
  }
  return result;
}
