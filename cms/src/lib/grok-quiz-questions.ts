/**
 * Drafts Breed Match quiz questions from free-text notes.
 *
 * The notes can be anything: a line from the team ("we never ask about
 * allergies"), or the raw "anything else we should know?" answers quiz takers
 * leave behind. Grok turns them into properly weighted questions, which land in
 * the Quiz Questions collection as drafts for review.
 */

import { TRAIT_KEYS, type TraitKey } from './grok-quiz-match'

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions'

const VALID_TYPES = ['single', 'multi', 'text'] as const
const VALID_LAYOUTS = ['grid', 'list', 'scale'] as const
const VALID_SCOPES = ['both', 'dog', 'cat'] as const
const VALID_SIZES = ['small', 'medium', 'large', 'giant']

export interface GeneratedQuizOption {
  label: string
  value: string
  emoji?: string
  description?: string
  weights: { trait: TraitKey; target: number; weight: number }[]
  prefersSizes?: string[]
}

export interface GeneratedQuizQuestion {
  question: string
  helper?: string
  key: string
  emoji?: string
  type: (typeof VALID_TYPES)[number]
  layout: (typeof VALID_LAYOUTS)[number]
  petScope: (typeof VALID_SCOPES)[number]
  placeholder?: string
  maxSelections?: number
  options: GeneratedQuizOption[]
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function slugify(input: string, fallback: string): string {
  const slug = String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || fallback
}

function pickEnum<T extends string>(raw: unknown, valid: readonly T[], fallback: T): T {
  const value = String(raw ?? '').toLowerCase().trim()
  return (valid as readonly string[]).includes(value) ? (value as T) : fallback
}

const SYSTEM_PROMPT = `You write questions for PawLabs' Breed Match quiz — the quiz that matches a person to a dog or cat breed.

You will be given notes. The notes come from two places: our team, and from quiz takers telling us what we forgot to ask. Turn them into quiz questions.

WHAT MAKES A GOOD QUESTION HERE:
- It changes the answer. If every breed scores the same on it, it is decoration — do not write it.
- It asks about the person's life, not about dogs. "How many hours is your home empty on a normal weekday?" not "Do you want a dog with separation anxiety?"
- It is answerable in two seconds without research. No jargon, no breed names, no trait names.
- It gives people permission to be honest. Nobody admits to being lazy; plenty of people will pick "I'd rather walk around the block than run a 10k."
- Options are concrete and mutually exclusive, and every realistic person finds themselves in one of them. 3-6 options.
- Conversational voice. Second person. Light, never cutesy.

TRAIT WEIGHTS — this is the important part:
Every option carries weights that steer the match. Each weight is a trait, a target score for that trait (1-10, what the ideal breed scores), and how much it matters (1 = nudge, 5 = dealbreaker).

Available traits (use these exact keys):
affectionLevel, childFriendly, petFriendly, strangerFriendly, trainability, energyLevel, groomingNeeds, sheddingLevel, barkingLevel, intelligence, playfulness, watchdogAbility, adaptability, healthRobustness

Note the direction of some traits: groomingNeeds, sheddingLevel and barkingLevel are how MUCH the breed needs/sheds/barks. Someone who wants a low-maintenance coat needs a LOW target on groomingNeeds, not a high one.

Rules for weights:
- 1-3 weights per option. More than that and nothing dominates.
- Options within one question must pull in genuinely different directions — that is the entire point.
- Use weight 4-5 only where the answer is close to a dealbreaker (small children, a flat with thin walls, a diagnosed allergy).
- prefersSizes is optional, only for questions about space or physical handling: any of small, medium, large, giant.

RESPONSE FORMAT — return ONLY a valid JSON object, no code fences:
{
  "questions": [
    {
      "question": "The question as the visitor reads it",
      "helper": "Optional one-line nudge under the question, or empty string",
      "key": "kebab-case-machine-key",
      "emoji": "single emoji",
      "type": "single | multi | text",
      "layout": "grid | list | scale",
      "petScope": "both | dog | cat",
      "options": [
        {
          "label": "What they click",
          "value": "kebab-case-value",
          "emoji": "single emoji",
          "description": "Optional half-sentence, or empty string",
          "weights": [{"trait": "energyLevel", "target": 3, "weight": 4}],
          "prefersSizes": []
        }
      ]
    }
  ]
}

Use layout "scale" only when the options form an ordered 1-5 style progression. Use "list" when option labels run long. Otherwise "grid".
Use type "text" only if the note genuinely calls for free-text; give it an empty options array.`

export async function generateQuizQuestionsWithGrok(
  notes: string,
  opts: {
    count?: number
    petScope?: 'both' | 'dog' | 'cat'
    existingQuestions?: { key: string; question: string }[]
  } = {},
): Promise<GeneratedQuizQuestion[]> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey || apiKey === 'your-xai-api-key-here') {
    throw new Error('XAI_API_KEY is not configured. Add it to cms/.env')
  }
  if (!notes.trim()) {
    throw new Error('Notes are required to draft questions')
  }

  const count = clamp(opts.count ?? 3, 1, 8)
  const existing = opts.existingQuestions ?? []

  const userPrompt = `NOTES TO TURN INTO QUESTIONS:
${notes.trim().slice(0, 6000)}

WRITE: ${count} question${count === 1 ? '' : 's'}.
DEFAULT PET SCOPE: ${opts.petScope ?? 'both'} (override per question only if the note is clearly about one species).

${
  existing.length
    ? `QUESTIONS THE QUIZ ALREADY ASKS — do not repeat these, and do not reuse their keys:
${existing.map((q) => `- [${q.key}] ${q.question}`).join('\n')}`
    : 'The quiz has no questions yet.'
}

Every question must earn its place. If the notes only support fewer good questions than asked for, write fewer.`

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
      temperature: 0.8,
      max_tokens: 6144,
    }),
    signal: AbortSignal.timeout(60000),
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

  let parsed: { questions?: unknown[] }
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    throw new Error(`Failed to parse Grok response as JSON: ${(e as Error).message}`)
  }

  const takenKeys = new Set(existing.map((q) => q.key))
  const out: GeneratedQuizQuestion[] = []

  for (const [i, raw] of (parsed.questions ?? []).entries()) {
    const q = raw as Record<string, any>
    const questionText = String(q?.question ?? '').trim()
    if (!questionText) continue

    const type = pickEnum(q.type, VALID_TYPES, 'single')

    // Keys are permanent identifiers on stored answers, so they must be unique.
    let key = slugify(q.key || questionText, `question-${i + 1}`)
    let suffix = 2
    while (takenKeys.has(key)) key = `${slugify(q.key || questionText, `question-${i + 1}`)}-${suffix++}`
    takenKeys.add(key)

    const seenValues = new Set<string>()
    const options: GeneratedQuizOption[] =
      type === 'text'
        ? []
        : (Array.isArray(q.options) ? q.options : [])
            .map((rawOpt: any, oi: number): GeneratedQuizOption | null => {
              const label = String(rawOpt?.label ?? '').trim()
              if (!label) return null
              let value = slugify(rawOpt?.value || label, `option-${oi + 1}`)
              let vs = 2
              while (seenValues.has(value)) value = `${value}-${vs++}`
              seenValues.add(value)

              const weights = (Array.isArray(rawOpt?.weights) ? rawOpt.weights : [])
                .map((w: any) => ({
                  trait: String(w?.trait ?? '') as TraitKey,
                  target: clamp(Math.round(Number(w?.target)) || 5, 1, 10),
                  weight: clamp(Math.round(Number(w?.weight)) || 3, 1, 5),
                }))
                .filter((w: { trait: string }) => TRAIT_KEYS.includes(w.trait as TraitKey))
                .slice(0, 4)

              const prefersSizes = (Array.isArray(rawOpt?.prefersSizes) ? rawOpt.prefersSizes : [])
                .map((s: unknown) => String(s).toLowerCase().trim())
                .filter((s: string) => VALID_SIZES.includes(s))

              return {
                label: label.slice(0, 120),
                value,
                emoji: String(rawOpt?.emoji ?? '').trim().slice(0, 8) || undefined,
                description: String(rawOpt?.description ?? '').trim().slice(0, 160) || undefined,
                weights,
                prefersSizes: prefersSizes.length ? prefersSizes : undefined,
              }
            })
            .filter((o): o is GeneratedQuizOption => o !== null)

    // A choice question with fewer than two options cannot be answered.
    if (type !== 'text' && options.length < 2) continue

    out.push({
      question: questionText.slice(0, 200),
      helper: String(q.helper ?? '').trim().slice(0, 200) || undefined,
      key,
      emoji: String(q.emoji ?? '').trim().slice(0, 8) || undefined,
      type,
      layout: pickEnum(q.layout, VALID_LAYOUTS, 'grid'),
      petScope: pickEnum(q.petScope, VALID_SCOPES, opts.petScope ?? 'both'),
      placeholder: type === 'text' ? String(q.placeholder ?? '').slice(0, 120) || undefined : undefined,
      maxSelections:
        type === 'multi' && Number(q.maxSelections) > 0
          ? clamp(Math.round(Number(q.maxSelections)), 1, 10)
          : undefined,
      options,
    })
  }

  if (out.length === 0) {
    throw new Error('Grok did not return any usable questions. Try more specific notes.')
  }

  return out
}
