/**
 * Server-side Grok API client for generating breed profiles.
 * Called by the custom /api/ai/breed route.
 */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

/** Valid breed groups — must match Breeds.ts collection options */
const VALID_BREED_GROUPS = [
  'sporting', 'working', 'herding', 'toy', 'terrier', 'hound',
  'non-sporting', 'foundation-stock', 'natural', 'hybrid', 'mutation', 'crossbreed',
] as const;

const VALID_SIZES = ['small', 'medium', 'large', 'giant'] as const;
const VALID_COAT_TYPES = ['smooth', 'double', 'wire', 'curly', 'silky', 'hairless', 'long', 'short', 'medium', 'rough'] as const;
const VALID_COAT_LENGTHS = ['short', 'medium', 'long', 'hairless'] as const;

type ValidBreedGroup = typeof VALID_BREED_GROUPS[number];
type ValidSize = typeof VALID_SIZES[number];
type ValidCoatType = typeof VALID_COAT_TYPES[number];
type ValidCoatLength = typeof VALID_COAT_LENGTHS[number];

function normalizeEnum<T extends string>(raw: string, valid: readonly T[], fallback: T): T {
  const lower = raw.toLowerCase().trim();
  if ((valid as readonly string[]).includes(lower)) return lower as T;
  // Substring match
  for (const v of valid) {
    if (lower.includes(v) || v.includes(lower)) return v;
  }
  return fallback;
}

export interface GeneratedBreed {
  name: string;
  slug: string;
  petType: 'dog' | 'cat';
  shortDescription: string;
  breedGroup: string;
  breedRole: string;
  size: string;
  heightMin: number;
  heightMax: number;
  weightMin: number;
  weightMax: number;
  lifeExpectancyMin: number;
  lifeExpectancyMax: number;
  coatType: string;
  coatLength: string;
  colors: { color: string }[];
  origin: string;
  temperament: { trait: string }[];
  strengths: { point: string }[];
  weaknesses: { point: string }[];
  traits: {
    affectionLevel: number;
    childFriendly: number;
    petFriendly: number;
    strangerFriendly: number;
    trainability: number;
    energyLevel: number;
    groomingNeeds: number;
    sheddingLevel: number;
    barkingLevel: number;
    intelligence: number;
    playfulness: number;
    watchdogAbility: number;
    adaptability: number;
    healthRobustness: number;
  };
  breedHistory: string;
  article: string;
}

const SYSTEM_PROMPT = `You are a veteran pet breed expert and writer for PawLabs, a trusted resource for pet parents researching breeds. You've worked with hundreds of breeders, veterinarians, and rescue organizations.

YOUR WRITING PERSONALITY:
- You write from genuine experience. You've met dozens of every breed. You have real opinions.
- You use first-person naturally. "I've seen Golden Retriever puppies destroy a couch in 20 minutes flat" not "This breed may be destructive."
- You're honest about both the joys and challenges of each breed.
- You reference specific real-world scenarios: the 5am energy zoomies, the separation anxiety when you leave for work, the gentle way they play with toddlers.
- Your sentence length varies. Short punchy facts. Then longer thoughts where you explore nuance.
- You NEVER use: "game-changer," "it's worth noting," "in conclusion," "overall," "when it comes to."
- You NEVER use bullet points inside article content — that's what structured fields are for.

TRAIT RATINGS GUIDE (1-10 scale):
- Be accurate to breed standards. A Border Collie gets 10 trainability, a Basenji gets 3-4.
- A Bulldog gets 2 energy, a Husky gets 9-10.
- Don't inflate scores. Most breeds should NOT get 8+ on everything.
- Consider the breed's PRIMARY purpose and temperament data from kennel clubs.

ARTICLE STRUCTURE (use HTML h2/h3/p tags):
1. h2 opening with a specific, opinionated take about the breed
2. h3 "Temperament & Personality" - daily life with this breed
3. h3 "Exercise & Activity Needs" - realistic exercise requirements  
4. h3 "Training & Intelligence" - what training is actually like
5. h3 "Health & Lifespan" - common health issues, vet costs, longevity
6. h3 "Grooming & Maintenance" - real grooming routine
7. h3 "Diet & Nutrition" - feeding needs and considerations
8. h3 "Living Conditions" - apartment vs house, yard needs, climate
9. h3 "Who Should Get This Breed" - honest recommendation of ideal owner
10. h3 "Who Should NOT Get This Breed" - equally honest about who should avoid it

The article MUST be 1000-1500 words of flowing prose. Dense with real information.

BREED HISTORY should be 150-300 words covering origin, original purpose, how the breed developed, and key milestones.

RESPONSE FORMAT:
Return ONLY a valid JSON object (no markdown, no code fences):
{
  "name": "Full Breed Name",
  "slug": "url-friendly-slug",
  "petType": "dog" or "cat",
  "shortDescription": "One compelling sentence, 20 words max",
  "breedGroup": "MUST be one of: sporting, working, herding, toy, terrier, hound, non-sporting, foundation-stock, natural, hybrid, mutation, crossbreed",
  "breedRole": "Original purpose (e.g. Retrieving waterfowl, Herding sheep, Companion)",
  "size": "small, medium, large, or giant",
  "heightMin": 21,
  "heightMax": 24,
  "weightMin": 55,
  "weightMax": 75,
  "lifeExpectancyMin": 10,
  "lifeExpectancyMax": 12,
  "coatType": "one of: smooth, double, wire, curly, silky, hairless, long, short, medium, rough",
  "coatLength": "short, medium, long, or hairless",
  "colors": [{"color": "Golden"}, {"color": "Cream"}],
  "origin": "Country or region",
  "temperament": [{"trait": "Loyal"}, {"trait": "Gentle"}, {"trait": "Intelligent"}],
  "strengths": [{"point": "Specific strength"}],
  "weaknesses": [{"point": "Specific weakness"}],
  "traits": {
    "affectionLevel": 9,
    "childFriendly": 9,
    "petFriendly": 8,
    "strangerFriendly": 8,
    "trainability": 9,
    "energyLevel": 7,
    "groomingNeeds": 6,
    "sheddingLevel": 8,
    "barkingLevel": 4,
    "intelligence": 9,
    "playfulness": 8,
    "watchdogAbility": 5,
    "adaptability": 7,
    "healthRobustness": 5
  },
  "breedHistory": "<p>HTML history content...</p>",
  "article": "<h2>...</h2><p>...</p><h3>...</h3><p>...</p>"
}

IMPORTANT: All HTML fields must use <h2>, <h3>, and <p> tags. No markdown. No code fences around the JSON.`;

export async function generateBreedWithGrok(
  breedName: string,
  petType: 'dog' | 'cat' = 'dog',
  extraContext?: string,
): Promise<GeneratedBreed> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || apiKey === 'your-xai-api-key-here') {
    throw new Error('XAI_API_KEY is not configured. Add it to cms/.env');
  }

  const userPrompt = `Generate a complete breed profile for:

BREED: ${breedName}
PET TYPE: ${petType}

${extraContext ? `ADDITIONAL CONTEXT: ${extraContext}\n` : ''}
Use your deep knowledge of this breed — the real temperament data, real health issues, real kennel club standards. Write like someone who has spent years with this breed. Make the trait ratings ACCURATE to established breed data, not inflated.

Remember: Be specific, honest, and opinionated. Make me understand what living with this breed is REALLY like.`;

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
      temperature: 0.8,
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

  let breed: GeneratedBreed;
  try {
    breed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse Grok response as JSON: ${(e as Error).message}`);
  }

  // Normalize enums
  breed.petType = petType;
  breed.breedGroup = normalizeEnum(breed.breedGroup || '', VALID_BREED_GROUPS, 'non-sporting');
  breed.size = normalizeEnum(breed.size || '', VALID_SIZES, 'medium');
  breed.coatType = normalizeEnum(breed.coatType || '', VALID_COAT_TYPES, 'short');
  breed.coatLength = normalizeEnum(breed.coatLength || '', VALID_COAT_LENGTHS, 'medium');

  // Clamp trait values to 1-10
  if (breed.traits) {
    for (const key of Object.keys(breed.traits) as (keyof typeof breed.traits)[]) {
      const val = breed.traits[key];
      if (typeof val === 'number') {
        breed.traits[key] = Math.max(1, Math.min(10, Math.round(val)));
      }
    }
  }

  return breed;
}
