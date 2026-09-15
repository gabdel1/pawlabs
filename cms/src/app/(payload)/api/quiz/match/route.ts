import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import {
  matchBreedsWithGrok,
  type BreedLite,
  type ResolvedAnswer,
  type TraitKey,
} from '../../../../../lib/grok-quiz-match'
import { isValidEmail, subscribeToBrevo } from '../../../../../lib/brevo'

/**
 * Public Breed Match endpoint. Called from the static site's /quiz page.
 *
 * Unauthenticated by necessity, so it is defensive: rate limited per IP, every
 * field length-capped, and — importantly — the trait weights that drive the
 * match are read from the Quiz Questions collection by answer key. The client
 * sends only which option it picked. It cannot send weights, so it cannot steer
 * the match or inflate the prompt.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/** Each match costs a Grok call, so the ceiling is deliberately low. */
const RATE_LIMIT_MAX = 12
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const MAX_ANSWERS = 40
const MAX_VALUES_PER_ANSWER = 12
const MAX_NOTE_LENGTH = 800

const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)

  // Opportunistic sweep so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) hits.delete(key)
    }
  }

  return recent.length > RATE_LIMIT_MAX
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function asStringArray(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [value]
  return raw
    .filter((v) => typeof v === 'string')
    .map((v) => (v as string).trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, MAX_VALUES_PER_ANSWER)
}

type QuizQuestionDoc = {
  key: string
  question: string
  type?: string
  options?: {
    label?: string
    value?: string
    weights?: { trait?: string; target?: number; weight?: number }[]
    prefersSizes?: string[]
  }[]
}

/** Map a breed doc down to only what scoring and the results page need. */
function toBreedLite(doc: Record<string, any>): BreedLite {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    petType: doc.petType,
    size: doc.size,
    breedGroup: doc.breedGroup,
    breedRole: doc.breedRole,
    shortDescription: doc.shortDescription,
    origin: doc.origin,
    lifeExpectancyMin: doc.lifeExpectancyMin,
    lifeExpectancyMax: doc.lifeExpectancyMax,
    weightMin: doc.weightMin,
    weightMax: doc.weightMax,
    coatLength: doc.coatLength,
    temperament: Array.isArray(doc.temperament)
      ? doc.temperament.map((t: any) => t?.trait).filter(Boolean).slice(0, 6)
      : [],
    traits: (doc.traits ?? {}) as Partial<Record<TraitKey, number>>,
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    if (rateLimited(clientIp(req))) {
      return NextResponse.json(
        { error: "You've run the quiz a few times already. Try again in an hour." },
        { status: 429, headers: CORS_HEADERS },
      )
    }

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const petType = ['dog', 'cat', 'either'].includes(String(body.petType))
      ? (String(body.petType) as 'dog' | 'cat' | 'either')
      : 'either'
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE_LENGTH) : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
    const consent = body.consent === true
    const source = typeof body.source === 'string' ? body.source.slice(0, 80) : 'quiz'

    const rawAnswers = Array.isArray(body.answers) ? body.answers.slice(0, MAX_ANSWERS) : []
    if (rawAnswers.length === 0) {
      return NextResponse.json(
        { error: 'Answer at least one question first' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const payload = await getPayload({ config: configPromise })

    // ── Resolve answers against the published questions ──────────────
    const questionsRes = await payload.find({
      collection: 'quiz-questions',
      where: { status: { equals: 'published' } },
      limit: 100,
      depth: 0,
      sort: 'order',
    })
    const questionsByKey = new Map<string, QuizQuestionDoc>(
      (questionsRes.docs as unknown as QuizQuestionDoc[]).map((q) => [q.key, q]),
    )

    const answers: ResolvedAnswer[] = []
    for (const raw of rawAnswers) {
      const entry = raw as Record<string, unknown>
      const key = typeof entry.key === 'string' ? entry.key.slice(0, 64) : ''
      const question = questionsByKey.get(key)
      if (!question) continue

      const values = asStringArray(entry.value)
      if (values.length === 0) continue

      if (question.type === 'text') {
        answers.push({
          key,
          question: question.question,
          answerLabels: values,
          answerValues: values,
          weights: [],
          prefersSizes: [],
          freeText: values.join(' ').slice(0, 400),
        })
        continue
      }

      const chosen = (question.options ?? []).filter(
        (opt) => opt.value && values.includes(opt.value),
      )
      if (chosen.length === 0) continue

      answers.push({
        key,
        question: question.question,
        answerLabels: chosen.map((o) => o.label || o.value || '').filter(Boolean),
        answerValues: chosen.map((o) => o.value as string),
        weights: chosen.flatMap((o) =>
          (o.weights ?? [])
            .filter((w) => typeof w.trait === 'string')
            .map((w) => ({
              trait: w.trait as TraitKey,
              target: Number(w.target) || 5,
              weight: Number(w.weight) || 3,
            })),
        ),
        prefersSizes: chosen.flatMap((o) => (Array.isArray(o.prefersSizes) ? o.prefersSizes : [])),
      })
    }

    if (answers.length === 0) {
      return NextResponse.json(
        { error: 'None of those answers matched a live question. Refresh and try again.' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    // ── Candidate breeds ─────────────────────────────────────────────
    const breedWhere: Record<string, unknown> = { status: { equals: 'published' } }
    if (petType !== 'either') breedWhere.petType = { equals: petType }

    const breedsRes = await payload.find({
      collection: 'breeds',
      where: breedWhere as any,
      limit: 500,
      depth: 0,
      sort: 'name',
    })

    const breeds = (breedsRes.docs as Record<string, any>[]).map(toBreedLite)
    if (breeds.length === 0) {
      return NextResponse.json(
        { error: 'No breeds are published for that pet type yet.' },
        { status: 503, headers: CORS_HEADERS },
      )
    }

    const { payload: match } = await matchBreedsWithGrok(answers, breeds, note)

    // ── Enrich the three winners with what the results page renders ──
    const matchedIds = match.matches.map((m) => m.id)
    const fullRes = await payload.find({
      collection: 'breeds',
      where: { id: { in: matchedIds } } as any,
      limit: 10,
      depth: 1,
    })
    const fullById = new Map(
      (fullRes.docs as Record<string, any>[]).map((doc) => [String(doc.id), doc]),
    )

    const results = match.matches
      .map((m) => {
        const doc = fullById.get(String(m.id))
        if (!doc) return null
        const image = doc.image && typeof doc.image === 'object' ? doc.image : null
        return {
          ...m,
          name: doc.name as string,
          slug: doc.slug as string,
          petType: doc.petType as string,
          size: doc.size as string | undefined,
          breedGroup: doc.breedGroup as string | undefined,
          breedRole: doc.breedRole as string | undefined,
          origin: doc.origin as string | undefined,
          shortDescription: doc.shortDescription as string | undefined,
          lifeExpectancyMin: doc.lifeExpectancyMin as number | undefined,
          lifeExpectancyMax: doc.lifeExpectancyMax as number | undefined,
          weightMin: doc.weightMin as number | undefined,
          weightMax: doc.weightMax as number | undefined,
          // The static site serves media from /media/<filename>.
          imageFilename: (image?.filename as string | undefined) ?? null,
          imageAlt: (image?.alt as string | undefined) ?? doc.name,
          temperament: Array.isArray(doc.temperament)
            ? doc.temperament.map((t: any) => t?.trait).filter(Boolean).slice(0, 5)
            : [],
          traits: doc.traits ?? {},
        }
      })
      .filter(Boolean)

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'We could not build your match. Please try again.' },
        { status: 502, headers: CORS_HEADERS },
      )
    }

    const responseBody = {
      ok: true,
      profileLabel: match.profileLabel,
      summary: match.summary,
      tips: match.tips,
      matchedBy: match.matchedBy,
      matches: results,
    }

    // ── Newsletter + lead capture ────────────────────────────────────
    let subscribed = false
    if (email && isValidEmail(email) && consent) {
      const topBreed = (results[0] as any)?.name ?? ''
      const sub = await subscribeToBrevo(email, {
        SOURCE: 'breed-quiz',
        BREED: topBreed,
        PET_TYPE: petType,
      })
      subscribed = sub.ok
    }

    try {
      await payload.create({
        collection: 'quiz-submissions',
        data: {
          email: email && isValidEmail(email) ? email : undefined,
          subscribed,
          petType,
          matchedBy: match.matchedBy,
          topBreedName: (results[0] as any)?.name ?? '',
          recommendedBreeds: results.map((r: any) => r.id),
          note: note || undefined,
          answers: answers.map((a) => ({
            key: a.key,
            question: a.question,
            answer: a.freeText ?? a.answerLabels.join(', '),
          })),
          result: responseBody,
          source,
        } as any,
      })
    } catch (err) {
      // A failed audit write must never cost the visitor their result.
      console.error('[quiz-match] Failed to store submission:', err)
    }

    return NextResponse.json({ ...responseBody, subscribed }, { headers: CORS_HEADERS })
  } catch (error: any) {
    console.error('[quiz-match] Request failed:', error)
    return NextResponse.json(
      { error: 'Something went wrong finding your match. Please try again.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
