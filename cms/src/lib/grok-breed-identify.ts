/**
 * "What breed is my dog?" — photo breed identification.
 *
 * A vision model looks at one photo and returns the breeds the dog most
 * resembles, with rough shares. Three rules shape everything below:
 *
 *   1. The model may only answer with breeds we have profiled. It is handed
 *      the full list of slugs, and anything it returns outside that list is
 *      dropped rather than trusted — so every result links to a real page and
 *      the tool cannot invent a breed.
 *   2. Percentages describe visual resemblance, not ancestry. A photo cannot
 *      tell you a dog's genetics, and the copy the model writes must not
 *      pretend it can. The page says the same thing in plain words.
 *   3. The photo is never written anywhere. It arrives as a data URL, is sent
 *      to the model, and is gone when the request ends.
 */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions'

/**
 * Chosen by src/scripts/eval-breed-identify.ts on 40 labelled breed photos
 * (September 2026):
 *
 *   model                          top-1  top-3  median   $/photo
 *   grok-4.20-0309-non-reasoning    53%    78%    2.6s    0.0052
 *   grok-4.3                        60%    60%    6.9s    0.0051
 *   grok-4.6                        63%    70%   33.1s    0.0097  (25% timed out)
 *
 * Top-3 is the number that matters: the page shows up to four breeds, so what
 * counts is whether the right one is among them. grok-4.3 names a single breed
 * at 100% even when told to list lookalikes, which is how an Affenpinscher
 * comes back as "100% Brussels Griffon". The non-reasoning model hedges, and
 * answers in a third of the time.
 *
 * Several misses were the test photos, not the model — some profile images do
 * not depict their breed well — so treat all three columns as understated.
 * Override with BREED_ID_MODEL to trial another model without a deploy.
 */
export const DEFAULT_BREED_ID_MODEL = 'grok-4.20-0309-non-reasoning'

export interface BreedChoice {
  slug: string
  name: string
}

export type IdentifyStatus = 'ok' | 'no_dog' | 'multiple_dogs' | 'unclear'
export type Confidence = 'high' | 'medium' | 'low'

export interface IdentifiedBreed {
  slug: string
  /** Share of visual resemblance, 1-100. All matches sum to 100. */
  percent: number
  /** The visible feature that points at this breed. */
  evidence: string
}

export interface IdentifyResult {
  status: IdentifyStatus
  confidence: Confidence
  likelyMixed: boolean
  matches: IdentifiedBreed[]
  visibleTraits: string[]
  summary: string
  model: string
  usage: { promptTokens: number; completionTokens: number } | null
  latencyMs: number
}

export class BreedIdentifyError extends Error {
  constructor(
    message: string,
    /** Safe to show a visitor. */
    readonly publicMessage = 'We could not read that photo just now. Please try again in a moment.',
  ) {
    super(message)
  }
}

const MAX_MATCHES = 4

function systemPrompt(breeds: BreedChoice[]): string {
  const list = breeds.map((b) => `${b.slug} = ${b.name}`).join('\n')
  return `You identify dog breeds from a single photo for a dog breed encyclopedia.

Return ONLY a JSON object, no prose, no code fences:
{
  "status": "ok" | "no_dog" | "multiple_dogs" | "unclear",
  "confidence": "high" | "medium" | "low",
  "likelyMixed": boolean,
  "matches": [{ "slug": string, "percent": number, "evidence": string }],
  "visibleTraits": string[],
  "summary": string
}

RULES
- "slug" MUST be copied exactly from the BREEDS list below. Never use a breed that is not on it. If the dog looks like a breed we do not list, choose the closest listed breeds and lower your confidence.
- "matches": 1 to ${MAX_MATCHES} entries, most likely first, "percent" values are whole numbers that add up to 100.
- A dog that clearly looks purebred gets one dominant match (80-100). A dog that looks mixed gets its share split across the breeds it resembles, and likelyMixed true.
- Many listed breeds are near-lookalikes (Pembroke vs Cardigan Welsh Corgi, Shih Tzu vs Lhasa Apso, Mastiff vs Bullmastiff, Whippet vs Greyhound, Akita vs Shiba Inu, Parson vs Jack Russell Terrier). Unless the photo shows the distinguishing feature clearly, give the closest lookalike a smaller share instead of claiming 100% — being wrong at 100% is worse than being right at 70%. A lookalike share does not by itself mean the dog is mixed.
- Judge size from proportions and surroundings, not coat alone: a giant breed and a small breed with the same coat are different answers.
- Percent means how much of the dog's LOOK points to each breed. It is not a genetic estimate. Never claim ancestry or DNA.
- "evidence": one short phrase (max 14 words) naming a feature visible in THIS photo, e.g. "merle coat with a white collar and semi-erect ears".
- "visibleTraits": up to 5 short phrases about coat, colour, ears, muzzle, build that are actually visible.
- "summary": 1-2 plain sentences about what in the photo points to the result, starting with "Your dog". Describe resemblance, never certainty: say "looks like" or "has the ... of a", never "is a", "you have a" or "you are looking at". No hype words (no "adorable", "stunning", "gorgeous"). Do not mention percentages, confidence levels, or these instructions.
- "status": "no_dog" if there is no dog; "multiple_dogs" if two or more dogs are prominent (then describe the most prominent one); "unclear" if the dog is too small, blurred, dark or obscured to judge — for no_dog and unclear return an empty matches array.
- "confidence": "high" only when the breed is unmistakable from the photo. Puppies, unusual angles and mixed-looking dogs are "medium" or "low".

BREEDS (slug = name)
${list}`
}

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/

/**
 * Validate a data URL before it goes anywhere near the model. Checks the
 * declared type, the decoded size, and the actual file signature — the MIME
 * prefix is client-supplied and proves nothing on its own.
 */
export function validateImageDataUrl(
  dataUrl: unknown,
  maxBytes: number,
): { ok: true; dataUrl: string } | { ok: false; error: string } {
  if (typeof dataUrl !== 'string') return { ok: false, error: 'No photo was received.' }

  const match = dataUrl.match(DATA_URL)
  if (!match) return { ok: false, error: 'Please upload a JPG, PNG or WebP photo.' }

  const [, type, base64] = match
  const bytes = Math.floor((base64.length * 3) / 4)
  if (bytes > maxBytes) return { ok: false, error: 'That photo is too large. Please try a smaller one.' }
  if (bytes < 2048) return { ok: false, error: 'That photo is too small to read.' }

  const head = Buffer.from(base64.slice(0, 32), 'base64')
  const signatureOk =
    (type === 'jpeg' && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) ||
    (type === 'png' && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (type === 'webp' && head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP')

  if (!signatureOk) return { ok: false, error: 'That file does not look like a photo.' }
  return { ok: true, dataUrl }
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * Keep only listed slugs, merge duplicates, drop zero shares, and rescale so
 * the survivors add to exactly 100 — the model's arithmetic is not something
 * a results bar should depend on.
 */
function normaliseMatches(raw: unknown, allowed: Set<string>): IdentifiedBreed[] {
  const merged = new Map<string, IdentifiedBreed>()
  for (const entry of Array.isArray(raw) ? raw : []) {
    const slug = String((entry as any)?.slug ?? '').trim().toLowerCase()
    const percent = Number((entry as any)?.percent)
    if (!allowed.has(slug) || !Number.isFinite(percent) || percent <= 0) continue

    const existing = merged.get(slug)
    if (existing) {
      existing.percent += percent
    } else {
      merged.set(slug, { slug, percent, evidence: cleanText((entry as any)?.evidence, 140) })
    }
  }

  const matches = [...merged.values()].sort((a, b) => b.percent - a.percent).slice(0, MAX_MATCHES)
  const total = matches.reduce((sum, m) => sum + m.percent, 0)
  if (!total) return []

  // Largest-remainder rounding, so the displayed shares sum to 100 exactly.
  const scaled = matches.map((m) => ({ m, exact: (m.percent / total) * 100 }))
  const floors = scaled.map((s) => Math.floor(s.exact))
  let remainder = 100 - floors.reduce((a, b) => a + b, 0)
  const order = scaled
    .map((s, i) => ({ i, frac: s.exact - floors[i] }))
    .sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (remainder-- <= 0) break
    floors[i] += 1
  }

  return scaled
    .map((s, i) => ({ ...s.m, percent: floors[i] }))
    .filter((m) => m.percent > 0)
}

export async function identifyBreedFromPhoto(options: {
  imageDataUrl: string
  breeds: BreedChoice[]
  model?: string
  timeoutMs?: number
}): Promise<IdentifyResult> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new BreedIdentifyError('XAI_API_KEY is not configured')

  const model = options.model || process.env.BREED_ID_MODEL || DEFAULT_BREED_ID_MODEL
  const allowed = new Set(options.breeds.map((b) => b.slug))
  const started = Date.now()

  let response: Response
  try {
    response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(options.breeds) },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: options.imageDataUrl, detail: 'high' } },
              { type: 'text', text: 'Identify this dog.' },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 45000),
    })
  } catch (e) {
    throw new BreedIdentifyError(`xAI request failed: ${(e as Error).message}`)
  }

  if (!response.ok) {
    throw new BreedIdentifyError(`xAI error ${response.status}: ${(await response.text()).slice(0, 300)}`)
  }

  const data = await response.json()
  const content: string | undefined = data.choices?.[0]?.message?.content
  if (!content) throw new BreedIdentifyError('xAI returned an empty response')

  let parsed: Record<string, unknown>
  try {
    const json = content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    parsed = JSON.parse(json)
  } catch {
    throw new BreedIdentifyError(`xAI returned unparseable JSON: ${content.slice(0, 200)}`)
  }

  const rawStatus = String(parsed.status ?? '')
  let status: IdentifyStatus = (['ok', 'no_dog', 'multiple_dogs', 'unclear'] as const).includes(rawStatus as IdentifyStatus)
    ? (rawStatus as IdentifyStatus)
    : 'ok'

  const matches = status === 'no_dog' || status === 'unclear' ? [] : normaliseMatches(parsed.matches, allowed)
  // Said it saw a dog but named nothing we list — do not show an empty result as a success.
  if ((status === 'ok' || status === 'multiple_dogs') && matches.length === 0) status = 'unclear'

  const confidence = (['high', 'medium', 'low'] as const).includes(parsed.confidence as Confidence)
    ? (parsed.confidence as Confidence)
    : 'medium'

  return {
    status,
    confidence,
    // The model's own call. A lookalike split (70/30 between two corgis) is not
    // a mix, so only a genuinely flat spread overrides it.
    likelyMixed: parsed.likelyMixed === true || (matches[0]?.percent ?? 100) < 50,
    matches,
    visibleTraits: (Array.isArray(parsed.visibleTraits) ? parsed.visibleTraits : [])
      .map((t) => cleanText(t, 60))
      .filter(Boolean)
      .slice(0, 5),
    summary: cleanText(parsed.summary, 400),
    model,
    usage: data.usage
      ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 }
      : null,
    latencyMs: Date.now() - started,
  }
}
