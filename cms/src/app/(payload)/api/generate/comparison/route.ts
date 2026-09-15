import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import {
  generateBreedComparisonWithGrok,
  type BreedForComparison,
} from '../../../../../lib/grok-breed-compare'
import { clientIp, extractApiKey, rateLimit, verifyApiKey } from '../../../../../lib/api-key'

/**
 * Machine-facing comparison generator.
 *
 * POST a shared secret plus two or more breeds and it writes a full head-to-head
 * comparison into the CMS. Intended for scripted backfill — the interactive
 * equivalent is /admin/ai-breed-compare, which requires a logged-in session.
 *
 * Auth is a shared secret in GENERATE_API_KEY (see lib/api-key.ts). Not a
 * substitute for real auth if this ever becomes multi-tenant, but appropriate
 * for a single-operator automation hook.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization',
}

const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const MAX_BREEDS = 5

/** Must match the options on the Comparisons collection. */
const VALID_CRITERIA = [
  'lowShedding',
  'apartmentFriendly',
  'watchdogAbility',
  'energyLevel',
  'trainability',
  'childFriendly',
  'petFriendly',
  'easyGrooming',
  'barkingControl',
  'adaptability',
  'intelligence',
  'healthRobustness',
] as const

type Criterion = (typeof VALID_CRITERIA)[number]

const DEFAULT_CRITERIA: Criterion[] = [
  'childFriendly',
  'energyLevel',
  'trainability',
  'lowShedding',
  'apartmentFriendly',
]

/**
 * Score a breed on a criterion using the same mapping the comparison table
 * uses — some traits are inverted so that higher always means better.
 */
function criterionValue(traits: Record<string, number> | undefined, criterion: Criterion): number | null {
  if (!traits) return null
  const get = (k: string) => (typeof traits[k] === 'number' ? traits[k] : null)
  const invert = (v: number | null) => (v == null ? null : 11 - v)

  switch (criterion) {
    case 'lowShedding':
      return invert(get('sheddingLevel'))
    case 'easyGrooming':
      return invert(get('groomingNeeds'))
    case 'barkingControl':
      return invert(get('barkingLevel'))
    case 'apartmentFriendly': {
      const parts: number[] = []
      const adapt = get('adaptability')
      const energy = get('energyLevel')
      const bark = get('barkingLevel')
      if (adapt != null) parts.push(adapt)
      if (energy != null) parts.push(11 - energy)
      if (bark != null) parts.push(11 - bark)
      return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null
    }
    default:
      return get(criterion)
  }
}

/**
 * When the caller does not specify criteria, pick the ones where these breeds
 * actually differ — a comparison table where every row is a tie is useless.
 */
function deriveCriteria(breeds: BreedForComparison[], count = 5): Criterion[] {
  const spreads = VALID_CRITERIA.map((criterion) => {
    const values = breeds
      .map((b) => criterionValue(b.traits as Record<string, number> | undefined, criterion))
      .filter((v): v is number => v != null)
    if (values.length < 2) return { criterion, spread: -1 }
    return { criterion, spread: Math.max(...values) - Math.min(...values) }
  })
    .filter((s) => s.spread >= 0)
    .sort((a, b) => b.spread - a.spread)

  const picked = spreads.slice(0, count).map((s) => s.criterion)
  return picked.length >= 3 ? picked : DEFAULT_CRITERIA
}

/** Comparison slugs are unique; make room rather than throwing on a clash. */
async function uniqueSlug(payload: Awaited<ReturnType<typeof getPayload>>, base: string): Promise<string> {
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'comparison'
  let slug = clean
  for (let i = 2; i < 50; i++) {
    const existing = await payload.find({
      collection: 'comparisons',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length === 0) return slug
    slug = `${clean}-${i}`
  }
  return `${clean}-${Date.now()}`
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  // Discoverability: a GET explains itself rather than 404ing.
  return NextResponse.json(
    {
      endpoint: 'POST /api/generate/comparison',
      auth: 'Shared secret as "key" in the JSON body, or an X-Api-Key / Authorization: Bearer header.',
      required: { breeds: 'Array of 2-5 breed slugs or numeric ids' },
      optional: {
        criteria: `Array of ${VALID_CRITERIA.length} possible values; omitted = derived from where the breeds differ most`,
        context: 'Free-text steer for the writer, e.g. "focus on first-time owners"',
        status: '"draft" (default) or "published"',
        dryRun: 'true returns the generated article without saving',
        guide: 'A previously previewed article ({title, content, slug?, summary?, verdict?}) — saved as-is with no AI call',
      },
      validCriteria: VALID_CRITERIA,
      docs: 'See COMMANDS.md → Comparison Generation API',
    },
    { headers: CORS_HEADERS },
  )
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()

  try {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: CORS_HEADERS })
    }

    // ── Auth ─────────────────────────────────────────────────────────
    const auth = verifyApiKey(extractApiKey(req, body), 'GENERATE_API_KEY')
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: CORS_HEADERS })
    }

    // A request that carries its own `guide` is a save, not a generation — no AI
    // call, so it does not consume the rate limit.
    const providedGuide =
      body.guide && typeof body.guide === 'object' && !Array.isArray(body.guide)
        ? (body.guide as Record<string, unknown>)
        : null

    if (!providedGuide && rateLimit(`gen-comparison:${clientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        { error: `Rate limit reached (${RATE_LIMIT_MAX}/hour). Each call costs an AI request.` },
        { status: 429, headers: CORS_HEADERS },
      )
    }

    // ── Validate input ───────────────────────────────────────────────
    const rawBreeds = Array.isArray(body.breeds) ? body.breeds : []
    if (rawBreeds.length < 2) {
      return NextResponse.json(
        { error: 'Provide at least 2 breeds, as slugs or numeric ids, in "breeds".' },
        { status: 400, headers: CORS_HEADERS },
      )
    }
    if (rawBreeds.length > MAX_BREEDS) {
      return NextResponse.json(
        { error: `At most ${MAX_BREEDS} breeds per comparison.` },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const status = body.status === 'published' ? 'published' : 'draft'
    const dryRun = body.dryRun === true
    const context = typeof body.context === 'string' ? body.context.slice(0, 600) : undefined

    let criteria: Criterion[] | null = null
    if (Array.isArray(body.criteria) && body.criteria.length > 0) {
      const requested = body.criteria.map((c) => String(c))
      const invalid = requested.filter((c) => !(VALID_CRITERIA as readonly string[]).includes(c))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Unknown criteria: ${invalid.join(', ')}`, validCriteria: VALID_CRITERIA },
          { status: 400, headers: CORS_HEADERS },
        )
      }
      criteria = requested as Criterion[]
    }

    const payload = await getPayload({ config: configPromise })

    // ── Resolve breeds by slug or id, preserving caller order ────────
    const breeds: BreedForComparison[] = []
    const notFound: string[] = []

    for (const ref of rawBreeds) {
      const key = String(ref).trim()
      if (!key) continue

      const found = await payload.find({
        collection: 'breeds',
        where: /^\d+$/.test(key) ? { id: { equals: Number(key) } } : { slug: { equals: key } },
        limit: 1,
        depth: 0,
      })

      const doc = found.docs[0] as Record<string, any> | undefined
      if (!doc) {
        notFound.push(key)
        continue
      }
      if (breeds.some((b) => b.id === String(doc.id))) continue // ignore duplicates

      breeds.push({
        id: String(doc.id),
        name: doc.name,
        slug: doc.slug || '',
        petType: doc.petType ?? undefined,
        breedGroup: doc.breedGroup ?? undefined,
        size: doc.size ?? undefined,
        shortDescription: doc.shortDescription ?? undefined,
        traits: doc.traits ?? undefined,
      })
    }

    if (notFound.length > 0) {
      return NextResponse.json(
        { error: `No published breed matched: ${notFound.join(', ')}`, hint: 'Use the slug from /breeds/<slug>, or a numeric id.' },
        { status: 404, headers: CORS_HEADERS },
      )
    }
    if (breeds.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 distinct breeds after resolving.' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const resolvedCriteria = criteria ?? deriveCriteria(breeds)

    // ── Generate, or accept an article the caller already previewed ──
    let guide
    if (providedGuide) {
      const title = typeof providedGuide.title === 'string' ? providedGuide.title.trim() : ''
      const content = typeof providedGuide.content === 'string' ? providedGuide.content.trim() : ''
      if (!title || !content) {
        return NextResponse.json(
          { error: '"guide" must include at least a non-empty title and content.' },
          { status: 400, headers: CORS_HEADERS },
        )
      }
      guide = {
        title,
        content,
        slug: typeof providedGuide.slug === 'string' ? providedGuide.slug : title,
        summary: typeof providedGuide.summary === 'string' ? providedGuide.summary : '',
        verdict: typeof providedGuide.verdict === 'string' ? providedGuide.verdict : '',
      }
    } else {
      guide = await generateBreedComparisonWithGrok(breeds, resolvedCriteria, context)
    }

    const responseBase = {
      ok: true,
      breeds: breeds.map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
      criteria: resolvedCriteria,
      criteriaSource: criteria ? 'requested' : 'derived',
      generated: !providedGuide,
      elapsedSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
    }

    if (dryRun) {
      return NextResponse.json(
        { ...responseBase, saved: false, dryRun: true, guide },
        { headers: CORS_HEADERS },
      )
    }

    // ── Save ─────────────────────────────────────────────────────────
    const slug = await uniqueSlug(payload, guide.slug || guide.title)

    const saved = await payload.create({
      collection: 'comparisons',
      data: {
        title: guide.title,
        slug,
        summary: guide.summary,
        content: guide.content,
        verdict: guide.verdict,
        breeds: breeds.map((b) => Number(b.id)),
        comparisonCriteria: resolvedCriteria.map((c) => ({ criterion: c })),
        author: 'PawLabs Team',
        publishedDate: new Date().toISOString(),
        status,
      } as any,
    })

    return NextResponse.json(
      {
        ...responseBase,
        saved: true,
        comparison: {
          id: saved.id,
          title: (saved as any).title,
          slug: (saved as any).slug,
          status,
          adminUrl: `/admin/collections/comparisons/${saved.id}`,
          liveUrl: status === 'published' ? `https://pawlabs.org/compare/${(saved as any).slug}` : null,
        },
        note:
          status === 'published'
            ? 'Published. Run `npm run build` in /srv/pet to put it on the static site.'
            : 'Saved as a draft. Review it, set status to published, then run `npm run build`.',
      },
      { headers: CORS_HEADERS },
    )
  } catch (error: any) {
    console.error('[generate/comparison] Failed:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to generate the comparison.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
