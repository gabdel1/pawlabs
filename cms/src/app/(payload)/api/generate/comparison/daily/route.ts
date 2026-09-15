import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import {
  generateBreedComparisonWithGrok,
  type BreedForComparison,
} from '../../../../../../lib/grok-breed-compare'
import { generateRoundupWithGrok, type RoundupBreed } from '../../../../../../lib/grok-roundup'
import { clientIp, extractApiKey, rateLimit, verifyApiKey } from '../../../../../../lib/api-key'
import { pairKey, rankPairs, type PairBreed } from '../../../../../../lib/comparison-pairs'
import { ANGLES, scoreForAngle } from '../../../../../../lib/content-styles'

/**
 * The daily article.
 *
 * Takes the next due item from the content plan, dispatches it to the right
 * writer for its style, publishes the result, and links it back to the plan
 * row. Falls back to picking a head-to-head on the fly if the plan is empty, so
 * the timer never has a silent no-op day.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization',
}

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

const CRITERIA_POOL = [
  'lowShedding', 'apartmentFriendly', 'watchdogAbility', 'energyLevel',
  'trainability', 'childFriendly', 'petFriendly', 'easyGrooming',
  'barkingControl', 'adaptability', 'intelligence', 'healthRobustness',
] as const
type Criterion = (typeof CRITERIA_POOL)[number]

function criterionValue(traits: Record<string, number> | undefined, c: Criterion): number | null {
  if (!traits) return null
  const g = (k: string) => (typeof traits[k] === 'number' ? traits[k] : null)
  const inv = (v: number | null) => (v == null ? null : 11 - v)
  switch (c) {
    case 'lowShedding': return inv(g('sheddingLevel'))
    case 'easyGrooming': return inv(g('groomingNeeds'))
    case 'barkingControl': return inv(g('barkingLevel'))
    case 'apartmentFriendly': {
      const p: number[] = []
      const ad = g('adaptability'); const en = g('energyLevel'); const bk = g('barkingLevel')
      if (ad != null) p.push(ad)
      if (en != null) p.push(11 - en)
      if (bk != null) p.push(11 - bk)
      return p.length ? p.reduce((x, y) => x + y, 0) / p.length : null
    }
    default: return g(c)
  }
}

function pickCriteria(breeds: { traits?: Record<string, number> }[], count = 5): Criterion[] {
  const scored = CRITERIA_POOL.map((c) => {
    const vals = breeds.map((b) => criterionValue(b.traits, c)).filter((v): v is number => v != null)
    return { c, spread: vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : -1 }
  })
    .filter((s) => s.spread >= 0)
    .sort((x, y) => y.spread - x.spread)
  const picked = scored.slice(0, count).map((s) => s.c)
  return picked.length >= 3
    ? picked
    : ['childFriendly', 'energyLevel', 'trainability', 'lowShedding', 'apartmentFriendly']
}

async function uniqueSlug(payload: any, base: string): Promise<string> {
  const clean =
    base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'article'
  let slug = clean
  for (let i = 2; i < 50; i++) {
    const hit = await payload.find({
      collection: 'comparisons', where: { slug: { equals: slug } }, limit: 1, depth: 0,
    })
    if (hit.docs.length === 0) return slug
    slug = `${clean}-${i}`
  }
  return `${clean}-${Date.now()}`
}

function toPairBreed(d: Record<string, any>): PairBreed {
  return {
    id: String(d.id),
    name: d.name,
    slug: d.slug,
    petType: d.petType,
    breedGroup: d.breedGroup,
    size: d.size,
    featured: Boolean(d.featured),
    weightMin: d.weightMin,
    weightMax: d.weightMax,
    traits: d.traits ?? undefined,
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now()
  let planItemId: number | string | null = null
  let payload: any = null

  try {
    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      /* header auth with empty body */
    }

    const auth = verifyApiKey(extractApiKey(req, body), 'GENERATE_API_KEY')
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: CORS_HEADERS })
    }

    const dryRun = body.dryRun === true
    const status = body.status === 'draft' ? 'draft' : 'published'

    if (!dryRun && rateLimit(`daily:${clientIp(req)}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json({ error: `Rate limit reached (${RATE_LIMIT_MAX}/hour).` }, { status: 429, headers: CORS_HEADERS })
    }

    payload = await getPayload({ config: configPromise })

    const breedsRes = await payload.find({
      collection: 'breeds',
      where: { status: { equals: 'published' } },
      limit: 500, depth: 0, sort: 'name',
    })
    const allBreeds: PairBreed[] = (breedsRes.docs as Record<string, any>[]).map(toPairBreed)
    if (allBreeds.length < 3) {
      return NextResponse.json({ error: 'Need at least 3 published breeds.' }, { status: 503, headers: CORS_HEADERS })
    }

    // ── Take the next due plan item ──────────────────────────────────
    const due = await payload.find({
      collection: 'content-plan',
      where: {
        and: [
          { status: { equals: 'queued' } },
          { scheduledFor: { less_than_equal: new Date().toISOString() } },
        ],
      },
      sort: 'scheduledFor',
      limit: 1,
      depth: 0,
    })

    let item = due.docs[0] as Record<string, any> | undefined

    // Nothing due? Take the earliest queued item so the timer still produces.
    if (!item) {
      const anyQueued = await payload.find({
        collection: 'content-plan',
        where: { status: { equals: 'queued' } },
        sort: 'scheduledFor', limit: 1, depth: 0,
      })
      item = anyQueued.docs[0] as Record<string, any> | undefined
    }

    let style: string
    let plannedBreedIds: string[] = []
    let angleKey: string | undefined
    let breedGroup: string | undefined
    let reason: string

    if (item) {
      planItemId = item.id
      style = item.style
      angleKey = item.angleKey ?? undefined
      breedGroup = item.breedGroup ?? undefined
      reason = item.reason ?? ''
      plannedBreedIds = (item.breeds ?? []).map((b: any) => String(typeof b === 'object' && b ? b.id : b))
    } else {
      // Plan is empty — fall back to the on-the-fly pair picker.
      const compared = new Set<string>()
      const appearances = new Map<string, number>()
      const cmp = await payload.find({ collection: 'comparisons', limit: 2000, depth: 0 })
      for (const doc of cmp.docs as Record<string, any>[]) {
        const ids = (doc.breeds ?? []).map((b: any) => String(typeof b === 'object' && b ? b.id : b))
        for (const id of ids) appearances.set(id, (appearances.get(id) ?? 0) + 1)
        for (let i = 0; i < ids.length; i++)
          for (let j = i + 1; j < ids.length; j++) compared.add(pairKey(ids[i], ids[j]))
      }
      const ranked = rankPairs(allBreeds, compared, appearances, 1)
      if (ranked.length === 0) {
        return NextResponse.json({ error: 'Content plan is empty and every pair has been compared.' }, { status: 409, headers: CORS_HEADERS })
      }
      style = 'head-to-head'
      plannedBreedIds = [ranked[0].a.id, ranked[0].b.id]
      reason = `No plan item due — fell back to best remaining pair. ${ranked[0].reason}`
    }

    // ── Resolve the breeds this article needs ────────────────────────
    const byId = new Map(allBreeds.map((b) => [b.id, b]))
    let breeds: PairBreed[] = plannedBreedIds.map((id) => byId.get(id)).filter((b): b is PairBreed => !!b)
    // Angle keys may be "angle" or "angle::breedGroup" for group-scoped roundups.
    const baseAngleKey = angleKey?.split('::')[0]
    const angleGroup = angleKey?.includes('::') ? angleKey.split('::')[1] : undefined
    const angle = baseAngleKey ? ANGLES.find((a) => a.key === baseAngleKey) : undefined

    if (style === 'best-for') {
      if (!angle) throw new Error(`Plan item references unknown angle "${angleKey}"`)
      const scopeGroup = angleGroup ?? breedGroup
      const pool = scopeGroup ? allBreeds.filter((b) => b.breedGroup === scopeGroup) : allBreeds
      // Shortlisted now, not at plan time, so picks track the latest ratings.
      breeds = pool
        .map((b) => ({ b, s: scoreForAngle(b.traits, b.size, angle) }))
        .filter((x) => x.s > 0)
        .sort((x, y) => y.s - x.s)
        .slice(0, 6)
        .map((x) => x.b)
    } else if (style === 'group-roundup') {
      breeds = allBreeds.filter((b) => b.breedGroup === breedGroup).slice(0, 8)
    }

    const minimum = style === 'head-to-head' ? 2 : style === 'three-way' ? 3 : 4
    if (breeds.length < minimum) {
      throw new Error(`Style ${style} needs ${minimum} breeds, resolved ${breeds.length}`)
    }

    const criteria = pickCriteria(breeds)

    const picked = {
      planItemId,
      style,
      angleKey,
      breedGroup,
      breeds: breeds.map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
      criteria,
      reason,
    }

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, generated: false, picked }, { headers: CORS_HEADERS })
    }

    // ── Write it ─────────────────────────────────────────────────────
    let article: { title: string; slug: string; summary: string; content: string; verdict: string }

    if (style === 'best-for' || style === 'group-roundup') {
      const roundupBreeds: RoundupBreed[] = breeds.map((b) => ({
        id: b.id, name: b.name, slug: b.slug, size: b.size,
        breedGroup: b.breedGroup, traits: b.traits,
      }))
      article = await generateRoundupWithGrok({
        angleLabel: angle?.label ?? `${breedGroup} breeds`,
        intent: angle?.intent ?? `Someone weighing up the ${breedGroup} group as a whole.`,
        breeds: roundupBreeds,
        breedGroup: style === 'group-roundup' ? breedGroup : undefined,
      })
    } else {
      const forGrok: BreedForComparison[] = breeds.map((b) => ({
        id: b.id, name: b.name, slug: b.slug, petType: b.petType,
        breedGroup: b.breedGroup, size: b.size, traits: b.traits,
      }))
      article = await generateBreedComparisonWithGrok(forGrok, criteria)
    }

    const slug = await uniqueSlug(payload, article.slug || article.title)
    const saved = await payload.create({
      collection: 'comparisons',
      data: {
        title: article.title,
        slug,
        summary: article.summary,
        content: article.content,
        verdict: article.verdict,
        breeds: breeds.map((b) => Number(b.id)),
        comparisonCriteria: criteria.map((c) => ({ criterion: c })),
        author: 'PawLabs Team',
        publishedDate: new Date().toISOString(),
        status,
      } as any,
    })

    if (planItemId) {
      await payload.update({
        collection: 'content-plan',
        id: planItemId,
        data: { status: 'generated', generatedArticle: saved.id } as any,
      })
    }

    const remaining = await payload.count({
      collection: 'content-plan',
      where: { status: { equals: 'queued' } },
    })

    return NextResponse.json(
      {
        ok: true,
        generated: true,
        picked,
        elapsedSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
        planRemaining: remaining.totalDocs,
        comparison: {
          id: saved.id,
          title: (saved as any).title,
          slug: (saved as any).slug,
          status,
          adminUrl: `/admin/collections/comparisons/${saved.id}`,
          liveUrl: status === 'published' ? `https://pawlabs.org/compare/${(saved as any).slug}` : null,
        },
        note: 'The static site must be rebuilt before this is visible.',
      },
      { headers: CORS_HEADERS },
    )
  } catch (error: any) {
    console.error('[generate/daily] Failed:', error)
    // Mark the plan row so a poisonous item does not block the queue forever.
    if (planItemId && payload) {
      try {
        await payload.update({
          collection: 'content-plan',
          id: planItemId,
          data: { status: 'failed', lastError: String(error?.message ?? error).slice(0, 500) } as any,
        })
      } catch {
        /* reporting the original error matters more */
      }
    }
    return NextResponse.json(
      { error: error?.message || 'Daily article failed.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
