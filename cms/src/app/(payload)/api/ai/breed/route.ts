import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { generateBreedWithGrok } from '../../../../../lib/grok-breed'

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

    // Check authentication via cookie
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    const body = await req.json()
    const { breedName, petType, context, action, breed: preGenerated } = body || {}

    // Save action: use pre-generated breed data from preview (no re-generation)
    if (action === 'save') {
      if (!preGenerated) {
        return NextResponse.json(
          { error: 'Pre-generated breed data is required for save' },
          { status: 400, headers: CORS_HEADERS }
        )
      }

      const saveData: any = {
        ...preGenerated,
        status: 'draft',
        author: 'PawLabs Team',
        publishedDate: new Date().toISOString(),
      }

      const saved = await payload.create({
        collection: 'breeds',
        data: saveData,
      })
      return NextResponse.json(
        { success: true, saved: { id: saved.id, slug: (saved as any).slug } },
        { headers: CORS_HEADERS }
      )
    }

    // Preview action: generate via Grok AI
    if (!breedName) {
      return NextResponse.json(
        { error: 'Breed name is required' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const breed = await generateBreedWithGrok(breedName, petType || 'dog', context)

    return NextResponse.json(
      { success: true, breed },
      { headers: CORS_HEADERS }
    )
  } catch (error: any) {
    console.error('AI Breed Generate error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate breed profile' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
