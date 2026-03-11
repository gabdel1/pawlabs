import { NextRequest, NextResponse } from 'next/server'
import { generateWithGrok } from '../../../../../lib/grok'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(req: NextRequest) {
  try {
    // Verify the user is authenticated
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: req.headers })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { url, context, action } = body

    if (!url) {
      return NextResponse.json({ error: 'Missing product URL' }, { status: 400 })
    }

    // Step 1: Generate the product data with Grok
    const generated = await generateWithGrok(url, context)

    // If action is 'preview', just return the generated data
    if (action === 'preview') {
      return NextResponse.json({ success: true, product: generated })
    }

    // Step 2: Save to CMS
    const product = await payload.create({
      collection: 'products',
      data: {
        name: generated.name,
        slug: generated.slug,
        shortDescription: generated.shortDescription,
        price: generated.price,
        affiliateUrl: generated.affiliateUrl,
        category: generated.category as any,
        petType: (generated.animalTypes?.[0] ?? 'universal') as any,
        featured: generated.featured ?? false,
        rating: generated.rating,
        pros: generated.pros,
        cons: generated.cons,
      } as any,
    })

    return NextResponse.json({
      success: true,
      product: generated,
      saved: { id: product.id, slug: generated.slug },
    })
  } catch (error: any) {
    console.error('AI Generate error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate review' },
      { status: 500 },
    )
  }
}
