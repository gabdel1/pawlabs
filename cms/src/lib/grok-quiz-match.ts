/**
 * Breed Match engine.
 *
 * Two stages, so the AI never has to reason over 200 breeds at once and the
 * quiz still works when xAI is down:
 *
 *   1. Deterministic scoring. Every answer carries trait weights (set per
 *      option in the Quiz Questions collection). We score all published breeds
 *      against them and keep the strongest candidates.
 *   2. Grok picks the final three from that shortlist and writes the
 *      personalised read — the part a scoring function cannot do.
 *
 * If step 2 fails for any reason, step 1's ranking is returned with templated
 * copy, so the visitor always gets a result.
 */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions'

/** Number of breeds handed to Grok after deterministic scoring. */
const SHORTLIST_SIZE = 40

export const TRAIT_KEYS = [
  'affectionLevel',
  'childFriendly',
  'petFriendly',
  'strangerFriendly',
  'trainability',
  'energyLevel',
  'groomingNeeds',
  'sheddingLevel',
  'barkingLevel',
  'intelligence',
  'playfulness',
  'watchdogAbility',
  'adaptability',
  'healthRobustness',
] as const

export type TraitKey = (typeof TRAIT_KEYS)[number]

/** Short codes keep the shortlist compact in the prompt. */
const TRAIT_CODES: Record<TraitKey, string> = {
  affectionLevel: 'aff',
  childFriendly: 'kid',
  petFriendly: 'pet',
  strangerFriendly: 'str',
  trainability: 'trn',
  energyLevel: 'enr',
  groomingNeeds: 'grm',
  sheddingLevel: 'shd',
  barkingLevel: 'brk',
  intelligence: 'iq',
  playfulness: 'ply',
  watchdogAbility: 'wtc',
  adaptability: 'adp',
  healthRobustness: 'hlt',
}

export interface TraitWeight {
  trait: TraitKey
  /** Ideal score for this trait, 1-10. */
  target: number
  /** How much it matters, 1-5. */
  weight: number
}

/** One answered question, with the weights its chosen option(s) carry. */
export interface ResolvedAnswer {
  key: string
  question: string
  /** Human-readable answer(s) — what we show Grok. */
  answerLabels: string[]
  /** Raw stored value(s). */
  answerValues: string[]
  weights: TraitWeight[]
  prefersSizes: string[]
  /** Free-text answers carry no weights but still inform Grok. */
  freeText?: string
}

export interface BreedLite {
  id: number | string
  name: string
  slug: string
  petType?: string
  size?: string
  breedGroup?: string
  breedRole?: string
  shortDescription?: string
  origin?: string
  lifeExpectancyMin?: number
  lifeExpectancyMax?: number
  weightMin?: number
  weightMax?: number
  coatLength?: string
  temperament?: string[]
  traits?: Partial<Record<TraitKey, number>>
}

export interface ScoredBreed {
  breed: BreedLite
  /** 0-100 deterministic fit. */
  score: number
}

export interface MatchResult {
  id: number | string
  matchScore: number
  headline: string
  why: string[]
  watchOut: string
  dayInTheLife?: string
}

export interface QuizMatchPayload {
  profileLabel: string
  summary: string
  matches: MatchResult[]
  tips: string[]
  matchedBy: 'ai' | 'fallback'
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function traitValue(breed: BreedLite, trait: TraitKey): number {
  const raw = breed.traits?.[trait]
  return typeof raw === 'number' && !Number.isNaN(raw) ? clamp(raw, 1, 10) : 5
}

/**
 * Score one breed against the answers.
 *
 * Every weighted trait contributes a penalty proportional to how far the breed
 * sits from the target, scaled by how much the visitor cares. Size preferences
 * add a small bonus on top — they are a nudge, not a filter, because a great
 * temperament match one size band off still deserves to surface.
 */
export function scoreBreed(breed: BreedLite, answers: ResolvedAnswer[]): number {
  let penalty = 0
  let maxPenalty = 0
  let sizeBonus = 0
  let sizeOpportunities = 0

  for (const answer of answers) {
    for (const w of answer.weights) {
      if (!TRAIT_KEYS.includes(w.trait)) continue
      const target = clamp(w.target, 1, 10)
      const weight = clamp(w.weight, 1, 5)
      penalty += Math.abs(traitValue(breed, w.trait) - target) * weight
      maxPenalty += 9 * weight
    }
    if (answer.prefersSizes.length > 0) {
      sizeOpportunities += 1
      if (breed.size && answer.prefersSizes.includes(breed.size)) sizeBonus += 1
    }
  }

  // No weighted answers at all — everything is equally plausible.
  if (maxPenalty === 0 && sizeOpportunities === 0) return 50

  const traitFit = maxPenalty > 0 ? 1 - penalty / maxPenalty : 0.5
  const sizeFit = sizeOpportunities > 0 ? sizeBonus / sizeOpportunities : null

  // Traits carry the result; size preference tilts it by up to 15 points.
  const combined = sizeFit === null ? traitFit : traitFit * 0.85 + sizeFit * 0.15

  return Math.round(clamp(combined, 0, 1) * 100)
}

export function rankBreeds(breeds: BreedLite[], answers: ResolvedAnswer[]): ScoredBreed[] {
  return breeds
    .map((breed) => ({ breed, score: scoreBreed(breed, answers) }))
    .sort((a, b) => b.score - a.score || a.breed.name.localeCompare(b.breed.name))
}

/** One compact line per breed — id first so Grok can only answer with real ids. */
function formatShortlist(scored: ScoredBreed[]): string {
  return scored
    .map(({ breed, score }) => {
      const traits = TRAIT_KEYS.map((t) => `${TRAIT_CODES[t]}${traitValue(breed, t)}`).join(' ')
      const bits = [
        `#${breed.id}`,
        breed.name,
        breed.petType ?? 'dog',
        breed.size ?? 'medium',
        breed.breedGroup ?? '—',
        breed.breedRole ? breed.breedRole.slice(0, 40) : '—',
        `fit${score}`,
        traits,
      ]
      return bits.join(' | ')
    })
    .join('\n')
}

function formatAnswers(answers: ResolvedAnswer[]): string {
  return answers
    .map((a, i) => {
      const value = a.freeText?.trim() || a.answerLabels.join(', ')
      return `${i + 1}. ${a.question}\n   → ${value || '(skipped)'}`
    })
    .join('\n')
}

const SYSTEM_PROMPT = `You are PawLabs' breed matcher — a veteran breed consultant who has spent twenty years placing dogs and cats with families, and who has seen every way a mismatch goes wrong.

Someone just finished our quiz. You get their answers and a shortlist of breeds that already passed our trait scoring. Your job is to pick the three that genuinely fit THIS person and explain why in a way that feels like it was written for them and nobody else.

HOW YOU PICK:
- Only ever choose from the shortlist. Answer with the exact numeric ids given.
- The "fit" number on each line is our trait score. Respect it, but you may override it when the answers reveal something scoring cannot see — a first-time owner paired with a breed that needs an experienced hand, an apartment paired with a breed that needs land, a household with a toddler.
- The three picks should be genuinely different from each other, not three variations of the same dog. Give the person a real choice.
- Rank them. The first is your recommendation.

HOW YOU WRITE:
- Second person, direct. "You said you're out of the house nine hours a day — that's the whole ballgame for this breed."
- Quote their actual answers back at them. Specific beats generic every time.
- You have real opinions and you are honest about the hard parts. Nobody is served by a match that falls apart in month three.
- Vary your sentence length. Short. Then longer where the nuance earns it.
- Start sentences naturally. Never open with the breed name as a bare subject ("Whippet gives you…") — write "The Whippet gives you…" or lead with them, not the dog.
- NEVER use: "game-changer", "it's worth noting", "in conclusion", "overall", "when it comes to", "perfect companion", "furry friend", "look no further".
- No markdown, no bullet characters, no emoji in your text. Plain sentences.

NEVER EXPOSE OUR INTERNALS. The shortlist gives you trait codes and scores — "shd3", "grm8", "energy7", "fit82". Those are for your reasoning only. They must never appear in anything you write, in any form. Say "sheds almost nothing", not "its shd2 rating". Say "needs real grooming", not "its grm8 grooming demand". No trait codes, no numeric scores, no mention of a shortlist, ranking or fit score.

Name only the three breeds you picked. Never mention a breed that is not one of your three.

RESPONSE FORMAT — return ONLY a valid JSON object, no code fences:
{
  "profileLabel": "A 2-5 word name for this person's owner profile, title case (e.g. The Apartment Minimalist, Weekend Trail Family)",
  "summary": "2-3 sentences reading their lifestyle back to them — what they actually need in a pet, based on their answers. Second person.",
  "matches": [
    {
      "id": 12,
      "matchScore": 94,
      "headline": "One sentence, under 15 words, on why this breed and this person fit.",
      "why": ["Three to four sentences, each a separate string, each tied to a specific answer they gave."],
      "watchOut": "One honest sentence about the hardest part of living with this breed, given what they told us.",
      "dayInTheLife": "Two sentences painting a concrete ordinary Tuesday with this breed in their described home."
    }
  ],
  "tips": ["Three short, practical, specific next steps for this person — finding a breeder or rescue, what to budget for, what to train first."]
}

matchScore must be 60-99, honest, and strictly descending across the three matches. Return exactly 3 matches unless the shortlist is shorter.`

/** Human wording for each trait code, used when scrubbing leaked internals. */
const CODE_PHRASES: Record<string, string> = {
  aff: 'affection',
  kid: 'patience with children',
  pet: 'tolerance of other pets',
  str: 'friendliness with strangers',
  trn: 'trainability',
  enr: 'energy',
  grm: 'grooming needs',
  shd: 'shedding',
  brk: 'barking',
  iq: 'intelligence',
  ply: 'playfulness',
  wtc: 'watchfulness',
  adp: 'adaptability',
  hlt: 'health',
}

/**
 * The prompt forbids exposing our trait codes, but a model is not a contract.
 * Rewrite anything that slips through ("its shd2 rating" → "its shedding") so a
 * visitor never sees our internals.
 */
function sanitizeCopy(text: string): string {
  return text
    .replace(/\bfit\s?\d{1,3}\b/gi, '')
    .replace(
      /\b(aff|kid|pet|str|trn|enr|grm|shd|brk|iq|ply|wtc|adp|hlt)\s?\d{1,2}\b(\s+(score|rating|level|value)s?)?/gi,
      (_match, code: string) => CODE_PHRASES[code.toLowerCase()] ?? '',
    )
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

interface GrokMatchResponse {
  profileLabel?: string
  summary?: string
  matches?: MatchResult[]
  tips?: string[]
}

/** Templated result used when Grok is unreachable — the quiz never dead-ends. */
export function buildFallbackPayload(scored: ScoredBreed[]): QuizMatchPayload {
  const top = scored.slice(0, 3)
  return {
    profileLabel: 'Your Breed Shortlist',
    summary:
      'Here are the breeds whose temperament, energy and grooming profile line up most closely with the answers you gave. Read the full profile on each before you commit — the detail is where the decision gets made.',
    matches: top.map(({ breed, score }) => ({
      id: breed.id,
      matchScore: clamp(score, 60, 99),
      headline: `${breed.name} lines up with the traits you weighted most heavily.`,
      why: [
        breed.shortDescription ||
          `${breed.name} scores close to your answers across temperament, energy and grooming.`,
        `Size band: ${breed.size ?? 'medium'}. Originally bred for ${breed.breedRole ?? 'companionship'}.`,
      ],
      watchOut:
        'Read the full profile before deciding — every breed has a trade-off worth knowing about up front.',
    })),
    tips: [
      'Read the full profile for each breed before contacting anyone.',
      'Meet an adult of the breed, not just a puppy, before you commit.',
      'Check breed-specific rescues first — they place adults whose temperament is already known.',
    ],
    matchedBy: 'fallback',
  }
}

export async function matchBreedsWithGrok(
  answers: ResolvedAnswer[],
  breeds: BreedLite[],
  visitorNote?: string,
): Promise<{ payload: QuizMatchPayload; scored: ScoredBreed[] }> {
  const scored = rankBreeds(breeds, answers)
  const shortlist = scored.slice(0, SHORTLIST_SIZE)

  if (shortlist.length === 0) {
    throw new Error('No published breeds are available to match against')
  }

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey || apiKey === 'your-xai-api-key-here') {
    console.warn('[quiz-match] XAI_API_KEY not configured — returning trait-scored fallback')
    return { payload: buildFallbackPayload(shortlist), scored }
  }

  const userPrompt = `THEIR ANSWERS:
${formatAnswers(answers)}
${visitorNote?.trim() ? `\nTHEY ALSO TOLD US:\n${visitorNote.trim().slice(0, 800)}\n` : ''}
SHORTLIST — pick 3, by id, from these only:
(format: #id | name | pet | size | group | original role | our trait fit | trait scores 1-10)
${formatShortlist(shortlist)}

TRAIT CODES: aff=affection kid=child-friendly pet=pet-friendly str=stranger-friendly trn=trainability enr=energy grm=grooming-needs shd=shedding brk=barking iq=intelligence ply=playfulness wtc=watchdog adp=adaptability hlt=health

Pick the three that fit this specific person and write it so they can feel you read their answers.`

  try {
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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!response.ok) {
      throw new Error(`Grok API error (${response.status}): ${(await response.text()).slice(0, 300)}`)
    }

    const data = await response.json()
    const content: string | undefined = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Grok returned an empty response')

    let jsonStr = content.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(jsonStr) as GrokMatchResponse

    // Grok can only be trusted to the extent we can verify it: drop any id that
    // is not on the shortlist we sent.
    const allowed = new Map(shortlist.map((s) => [String(s.breed.id), s]))
    const matches: MatchResult[] = []
    for (const m of parsed.matches ?? []) {
      const entry = allowed.get(String(m.id))
      if (!entry || matches.some((x) => String(x.id) === String(m.id))) continue
      matches.push({
        id: entry.breed.id,
        matchScore: clamp(Math.round(Number(m.matchScore) || entry.score), 60, 99),
        headline: sanitizeCopy(String(m.headline ?? '').slice(0, 220)),
        why: (Array.isArray(m.why) ? m.why : [])
          .filter((w) => typeof w === 'string' && w.trim())
          .map((w) => sanitizeCopy(w.slice(0, 600)))
          .slice(0, 5),
        watchOut: sanitizeCopy(String(m.watchOut ?? '').slice(0, 600)),
        dayInTheLife: m.dayInTheLife ? sanitizeCopy(String(m.dayInTheLife).slice(0, 600)) : undefined,
      })
      if (matches.length === 3) break
    }

    if (matches.length === 0) {
      console.warn('[quiz-match] Grok returned no usable ids — falling back to trait scoring')
      return { payload: buildFallbackPayload(shortlist), scored }
    }

    // Keep the displayed scores strictly descending so the ranking reads right.
    for (let i = 1; i < matches.length; i++) {
      if (matches[i].matchScore >= matches[i - 1].matchScore) {
        matches[i].matchScore = Math.max(60, matches[i - 1].matchScore - 3)
      }
    }

    return {
      payload: {
        profileLabel: sanitizeCopy(String(parsed.profileLabel ?? 'Your Breed Match').slice(0, 60)),
        summary: sanitizeCopy(String(parsed.summary ?? '').slice(0, 900)),
        matches,
        tips: (Array.isArray(parsed.tips) ? parsed.tips : [])
          .filter((t) => typeof t === 'string' && t.trim())
          .map((t) => sanitizeCopy(t.slice(0, 300)))
          .slice(0, 4),
        matchedBy: 'ai',
      },
      scored,
    }
  } catch (err) {
    console.error('[quiz-match] Grok match failed, using trait scoring:', err)
    return { payload: buildFallbackPayload(shortlist), scored }
  }
}
