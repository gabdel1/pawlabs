import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { generateWithGrok } from '../../../../../lib/grok'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/** Must match Products.ts collection options exactly */
const VALID_CATEGORIES = new Set([
  'smart-gadgets', 'toys', 'food-treats', 'health-wellness',
  'grooming', 'beds-furniture', 'leashes-collars', 'travel', 'other',
])

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
    const { url, context, action } = body || {}

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const product = await generateWithGrok(url, context)

    if (action === 'save') {
      // Map Grok's animalTypes array to Products collection's petType single select
      const saveData: any = { ...product }
      if (saveData.animalTypes && Array.isArray(saveData.animalTypes) && saveData.animalTypes.length > 0) {
        saveData.petType = saveData.animalTypes[0]
      }
      delete saveData.animalTypes
      delete saveData.subcategory // not in Products schema
      delete saveData.reviewBody // not a direct field in Products schema

      // Final safety: ensure category is a valid Products.ts option
      if (saveData.category && !VALID_CATEGORIES.has(saveData.category)) {
        console.warn(`[AI Generate] Invalid category "${saveData.category}", falling back to "other"`)
        saveData.category = 'other'
      }

      const saved = await payload.create({
        collection: 'products',
        data: saveData,
      })
      return NextResponse.json(
        { success: true, saved: { id: saved.id, slug: (saved as any).slug } },
        { headers: CORS_HEADERS }
      )
    }

    // Default: preview
    return NextResponse.json(
      { success: true, product },
      { headers: CORS_HEADERS }
    )
  } catch (error: any) {
    console.error('AI Generate error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate product' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
