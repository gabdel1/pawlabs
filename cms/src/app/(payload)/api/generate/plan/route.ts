import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { extractApiKey, verifyApiKey } from '../../../../../lib/api-key'
import { buildPlan } from '../../../../../lib/content-planner'
import { pairKey, type PairBreed } from '../../../../../lib/comparison-pairs'
import { ANGLES, STYLES } from '../../../../../lib/content-styles'

/**
 * Builds the content plan — a year of article ideas across the style pools.
 *
 * POST { key, days?, seed?, dryRun?, replace? }
 *
 * Existing queued items are left alone unless `replace` is set, so running this
 * again simply tops the plan back up.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  return NextResponse.json(
    {
      endpoint: 'POST /api/generate/plan',
      purpose: 'Build the rolling content plan the daily generator works through.',
      body: {
        key: 'Shared secret (or X-Api-Key header)',
        days: 'How many slots to plan. Default 365.',
        seed: 'Integer. Same seed + same data = same plan.',
        dryRun: 'true returns the plan without saving it',
        replace: 'true deletes existing queued items first',
      },
      styles: STYLES,
      angles: ANGLES.map((a) => ({ key: a.key, label: a.label })),
    },
    { headers: CORS_HEADERS },
  )
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      /* header auth with an empty body is fine */
    }

    const auth = verifyApiKey(extractApiKey(req, body), 'GENERATE_API_KEY')
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: CORS_HEADERS })
    }

    const days = Math.max(1, Math.min(Number(body.days) || 365, 730))
    const seed = Number(body.seed) || 20260731
    const dryRun = body.dryRun === true
    const replace = body.replace === true

    const payload = await getPayload({ config: configPromise })

    if (replace && !dryRun) {
      const queued = await payload.find({
        collection: 'content-plan',
        where: { status: { equals: 'queued' } },
        limit: 1000,
        depth: 0,
      })
      for (const doc of queued.docs) {
        await payload.delete({ collection: 'content-plan', id: (doc as any).id })
      }
    }

    // ── Current state: breeds, what has been written, what is already planned ──
    const breedsRes = await payload.find({
      collection: 'breeds',
      where: { status: { equals: 'published' } },
      limit: 500,
      depth: 0,
      sort: 'name',
    })
    const breeds: PairBreed[] = (breedsRes.docs as Record<string, any>[]).map((d) => ({
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
    }))

    if (breeds.length < 4) {
      return NextResponse.json(
        { error: 'Need at least 4 published breeds to build a plan.' },
        { status: 503, headers: CORS_HEADERS },
      )
    }

    const comparedPairs = new Set<string>()
    const appearances = new Map<string, number>()
    const comparisons = await payload.find({ collection: 'comparisons', limit: 2000, depth: 0 })
    for (const doc of comparisons.docs as Record<string, any>[]) {
      const ids = (doc.breeds ?? []).map((b: any) => String(typeof b === 'object' && b ? b.id : b))
      for (const id of ids) appearances.set(id, (appearances.get(id) ?? 0) + 1)
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) comparedPairs.add(pairKey(ids[i], ids[j]))
    }

    // Anything already planned counts as used, so a top-up never duplicates.
    const usedAngles = new Set<string>()
    const usedGroups = new Set<string>()
    const existingPlan = await payload.find({ collection: 'content-plan', limit: 2000, depth: 0 })
    let lastScheduled: Date | null = null
    for (const doc of existingPlan.docs as Record<string, any>[]) {
      if (doc.angleKey) usedAngles.add(doc.angleKey)
      if (doc.breedGroup) usedGroups.add(doc.breedGroup)
      const ids = (doc.breeds ?? []).map((b: any) => String(typeof b === 'object' && b ? b.id : b))
      for (const id of ids) appearances.set(id, (appearances.get(id) ?? 0) + 1)
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) comparedPairs.add(pairKey(ids[i], ids[j]))
      if (doc.scheduledFor) {
        const d = new Date(doc.scheduledFor)
        if (!lastScheduled || d > lastScheduled) lastScheduled = d
      }
    }

    // Continue the calendar from wherever it currently ends.
    const startDate = lastScheduled ? new Date(lastScheduled) : new Date()
    if (lastScheduled) startDate.setUTCDate(startDate.getUTCDate() + 1)
    startDate.setUTCHours(0, 0, 0, 0)

    const planned = buildPlan({
      breeds,
      comparedPairs,
      appearances,
      usedAngles,
      usedGroups,
      days,
      startDate,
      seed,
    })

    const byStyle = planned.reduce<Record<string, number>>((acc, item) => {
      acc[item.style] = (acc[item.style] ?? 0) + 1
      return acc
    }, {})

    if (dryRun) {
      return NextResponse.json(
        {
          ok: true,
          dryRun: true,
          planned: planned.length,
          byStyle,
          startsOn: planned[0]?.scheduledFor ?? null,
          endsOn: planned[planned.length - 1]?.scheduledFor ?? null,
          sample: planned.slice(0, 15).map((p) => ({
            date: p.scheduledFor,
            style: p.style,
            title: p.workingTitle,
            reason: p.reason,
          })),
        },
        { headers: CORS_HEADERS },
      )
    }

    let created = 0
    for (const item of planned) {
      await payload.create({
        collection: 'content-plan',
        data: {
          workingTitle: item.workingTitle,
          style: item.style,
          status: 'queued',
          scheduledFor: `${item.scheduledFor}T06:00:00.000Z`,
          score: item.score,
          angleKey: item.angleKey,
          breedGroup: item.breedGroup,
          breeds: item.breedIds.map((id) => Number(id)),
          reason: item.reason,
        } as any,
      })
      created++
    }

    return NextResponse.json(
      {
        ok: true,
        created,
        byStyle,
        startsOn: planned[0]?.scheduledFor ?? null,
        endsOn: planned[planned.length - 1]?.scheduledFor ?? null,
        adminUrl: '/admin/collections/content-plan',
      },
      { headers: CORS_HEADERS },
    )
  } catch (error: any) {
    console.error('[generate/plan] Failed:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to build the plan.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
