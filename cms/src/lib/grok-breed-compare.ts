/**
 * Server-side Grok API client for generating breed comparison guides.
 * Called by the /api/ai/breed-compare route.
 */

import { BANNED_PHRASES, shapeFor, titleHintFor } from './comparison-shapes'

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions'

export interface BreedForComparison {
  id: string
  name: string
  slug: string
  petType?: string
  breedGroup?: string
  size?: string
  shortDescription?: string
  traits?: {
    affectionLevel?: number
    childFriendly?: number
    petFriendly?: number
    strangerFriendly?: number
    trainability?: number
    energyLevel?: number
    groomingNeeds?: number
    sheddingLevel?: number
    barkingLevel?: number
    intelligence?: number
    playfulness?: number
    watchdogAbility?: number
    adaptability?: number
    healthRobustness?: number
  }
}

export interface GeneratedComparisonGuide {
  title: string
  slug: string
  summary: string
  content: string
  verdict: string
}

const SYSTEM_PROMPT = `You are a veteran dog breed expert and writer for PawLabs. You've lived with dozens of different breeds, trained dogs professionally for 15 years, and you write honestly from real experience.

You're being asked to write a breed comparison guide — a long-form article that helps prospective pet owners decide which breed fits their life best.

YOUR WRITING PERSONALITY:
- Write with authority drawn from breed standards, veterinary data and what owners consistently report — not from claimed personal experience.
- NEVER claim first-hand experience. You have not owned these dogs. No "I once had", "I've seen", "in my experience", "a client of mine". The byline on this site is an editorial team that researches breeds, and inventing lived experience is a fabricated credential.
- Get the same vividness from the breed's documented behaviour instead: "A Border Collie will stare at you for 45 minutes waiting for something to happen — it is the single most reported quirk of the breed." Concrete, and true.
- Be honest about what each breed is really like to live with — not just the marketing version.
- Have opinions. "If you're gone 9 hours a day, the Siberian Husky is not for you. The Golden Retriever will survive, but the Husky will destroy your house."
- Compare breeds head-to-head in concrete scenarios: apartment living, busy families, senior owners, first-time dog owners, etc.
- Use specific, vivid language. Instead of "high energy," say "needs 2+ hours of running per day or you'll find chewed furniture."
- NEVER use any phrase on the BANNED PHRASES list supplied with the request.
  Those are the exact strings that made every earlier article on this site look
  machine-made.
- DO describe real situations: training a Chow Chow vs a Lab, walking a Husky in winter, grooming a Poodle — in the second person ("you will find…"), never as something you personally did.

STRUCTURE REQUIREMENTS:
- Write a rich, detailed article in HTML (no \`\`\`html wrapper — raw HTML only)
- Use <h2>, <h3>, <p>, <ul>, <li>, <strong> tags
- Follow the ARTICLE PLAN supplied with each request. It changes from article to
  article by design: two editors writing the same comparison would not reach for
  the same headings in the same order, and neither should you.
- Write your own headings from that plan. Do NOT copy the plan's wording as
  headings, and do NOT fall back to a standard set of section titles.
- Vary sentence openings and paragraph shape. Some sections suit prose, some a
  short list, some a single blunt paragraph.
- Minimum 1200 words in content

VERDICT REQUIREMENTS:
- Separate <verdict> field (HTML)
- 3–5 paragraphs, opinionated and decisive
- Name a "top pick" scenario for each breed ("If you're X, go with Y")
- End with a strong recommendation or honest "it depends" with clear conditions`

function buildPrompt(breeds: BreedForComparison[], criteria: string[], context?: string): string {
  // Structure varies per article, chosen deterministically from the breeds.
  const slugs = breeds.map((b) => b.slug)
  const shape = shapeFor(slugs)
  const titleHint = titleHintFor(shape, breeds.map((b) => b.name), slugs)
  const breedDescriptions = breeds.map(b => {
    const traits = b.traits || {}
    return `
BREED: ${b.name}
- Type: ${b.petType || 'dog'}, ${b.breedGroup || 'unknown group'}, ${b.size || 'unknown size'}
- Short description: ${b.shortDescription || 'N/A'}
- Trait ratings (1-10):
  Affection: ${traits.affectionLevel ?? 'N/A'} | Child-friendly: ${traits.childFriendly ?? 'N/A'} | Pet-friendly: ${traits.petFriendly ?? 'N/A'}
  Trainability: ${traits.trainability ?? 'N/A'} | Energy: ${traits.energyLevel ?? 'N/A'} | Intelligence: ${traits.intelligence ?? 'N/A'}
  Grooming: ${traits.groomingNeeds ?? 'N/A'} | Shedding: ${traits.sheddingLevel ?? 'N/A'} | Barking: ${traits.barkingLevel ?? 'N/A'}
  Watchdog: ${traits.watchdogAbility ?? 'N/A'} | Adaptability: ${traits.adaptability ?? 'N/A'} | Health: ${traits.healthRobustness ?? 'N/A'}
`.trim()
  }).join('\n\n')

  const planBlock = [
    `ARTICLE PLAN (shape: ${shape.key})`,
    `Opening: ${shape.opening}`,
    'Cover, in this order, under headings you write yourself:',
    ...shape.plan.map((step, i) => `  ${i + 1}. ${step}`),
    `Closing: ${shape.closing}`,
    '',
    'BANNED PHRASES — do not use any of these, in headings or body:',
    ...BANNED_PHRASES.map((phrase) => `  - "${phrase}"`),
  ].join('\n')

  const criteriaList = criteria.join(', ')
  const contextNote = context ? `\nFOCUS / CONTEXT FROM EDITOR: ${context}\n` : ''

  return `Compare these ${breeds.length} breeds in a long-form guide:

${breedDescriptions}

KEY COMPARISON CRITERIA to highlight: ${criteriaList}

${planBlock}
${contextNote}
Breed names being compared: ${breeds.map(b => b.name).join(' vs ')}

Return ONLY valid JSON matching this exact structure:
{
  "title": "string — headline. Use '${titleHint}' unless you can write a better one in the same spirit. Never use 'Which Is Right for You?' — it is on every older article here.",
  "slug": "string — URL-safe, e.g. 'golden-retriever-vs-labrador-comparison'",
  "summary": "string — 1-2 sentence SEO meta description (no HTML)",
  "content": "string — full HTML article, minimum 1200 words",
  "verdict": "string — HTML verdict section, 3-5 paragraphs"
}`
}

export async function generateBreedComparisonWithGrok(
  breeds: BreedForComparison[],
  criteria: string[],
  context?: string,
): Promise<GeneratedComparisonGuide> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new Error('XAI_API_KEY environment variable is not set')

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(breeds, criteria, context) },
      ],
      temperature: 0.75,
      max_tokens: 6000,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Grok API error ${response.status}: ${text.slice(0, 300)}`)
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error('Empty response from Grok API')

  // Strip possible markdown code fences
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: GeneratedComparisonGuide
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`Failed to parse Grok response as JSON. Raw: ${jsonStr.slice(0, 500)}`)
  }

  // Validate required fields
  const required = ['title', 'slug', 'summary', 'content', 'verdict'] as const
  for (const field of required) {
    if (!parsed[field] || typeof parsed[field] !== 'string') {
      throw new Error(`Missing or invalid field "${field}" in Grok response`)
    }
  }

  // Sanitize slug
  parsed.slug = parsed.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return parsed
}
