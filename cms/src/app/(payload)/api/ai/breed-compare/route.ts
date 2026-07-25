import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { generateBreedComparisonWithGrok, type BreedForComparison } from '../../../../../lib/grok-breed-compare'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const body = await req.json()
    const { breedIds, criteria, context, action } = body || {}

    if (!breedIds || !Array.isArray(breedIds) || breedIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 breed IDs are required' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
      return NextResponse.json(
        { error: 'At least 1 comparison criterion is required' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    // Fetch full breed data
    const breeds: BreedForComparison[] = []
    for (const id of breedIds) {
      const breed = await payload.findByID({
        collection: 'breeds',
        id,
        depth: 0,
      })
      if (breed) {
        breeds.push({
          id: String(breed.id),
          name: (breed as any).name,
          slug: (breed as any).slug || '',
          petType: (breed as any).petType ?? undefined,
          breedGroup: (breed as any).breedGroup ?? undefined,
          size: (breed as any).size ?? undefined,
          shortDescription: (breed as any).shortDescription ?? undefined,
          traits: (breed as any).traits ?? undefined,
        })
      }
    }

    if (breeds.length < 2) {
      return NextResponse.json(
        { error: 'Could not find at least 2 valid breeds' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    // Generate comparison with Grok
    const guide = await generateBreedComparisonWithGrok(breeds, criteria, context)

    if (action === 'save') {
      const saved = await payload.create({
        collection: 'comparisons',
        data: {
          title: guide.title,
          slug: guide.slug,
          summary: guide.summary,
          content: guide.content,
          verdict: guide.verdict,
          breeds: breedIds,
          comparisonCriteria: criteria.map((c: string) => ({ criterion: c })),
          author: 'PawLabs Team',
          publishedDate: new Date().toISOString(),
          status: 'draft',
        } as any,
      })
      return NextResponse.json(
        { success: true, guide, saved: { id: saved.id, slug: (saved as any).slug } },
        { headers: CORS_HEADERS },
      )
    }

    // Default: preview
    return NextResponse.json({ success: true, guide }, { headers: CORS_HEADERS })
  } catch (error: any) {
    console.error('AI Breed Compare error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate breed comparison' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
