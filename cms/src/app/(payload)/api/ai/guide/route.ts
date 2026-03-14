import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { generateGuideWithGrok, injectAffiliateLinks } from '../../../../../lib/grok-guide'
import type { ProductForGuide } from '../../../../../lib/grok-guide'

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

    // Check authentication
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    const body = await req.json()
    const { productIds, context, action } = body || {}

    if (!productIds || !Array.isArray(productIds) || productIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 product IDs are required' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Fetch full product data from Payload
    const products: ProductForGuide[] = []
    for (const id of productIds) {
      const product = await payload.findByID({
        collection: 'products',
        id,
        depth: 0,
      })
      if (product) {
        products.push({
          id: String(product.id),
          name: product.name,
          slug: (product as any).slug || '',
          price: (product as any).price ?? undefined,
          category: (product as any).category ?? undefined,
          petType: (product as any).petType ?? undefined,
          rating: (product as any).rating ?? undefined,
          shortDescription: (product as any).shortDescription ?? undefined,
          affiliateUrl: (product as any).affiliateUrl ?? undefined,
          pros: (product as any).pros ?? undefined,
          cons: (product as any).cons ?? undefined,
        })
      }
    }

    if (products.length < 2) {
      return NextResponse.json(
        { error: 'Could not find at least 2 valid products' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Generate guide with Grok
    const guide = await generateGuideWithGrok(products, context)

    // Replace product placeholders with real affiliate links
    guide.content = injectAffiliateLinks(guide.content, products)

    if (action === 'save') {
      const saved = await payload.create({
        collection: 'guides',
        data: {
          title: guide.title,
          slug: guide.slug,
          guideType: guide.guideType,
          summary: guide.summary,
          content: guide.content,
          products: productIds,
          category: guide.category || 'mixed',
          petType: guide.petType || 'universal',
          author: 'PawLabs Team',
          publishedDate: new Date().toISOString(),
          status: 'draft',
        } as any,
      })
      return NextResponse.json(
        { success: true, guide, saved: { id: saved.id, slug: (saved as any).slug } },
        { headers: CORS_HEADERS }
      )
    }

    // Default: preview
    return NextResponse.json(
      { success: true, guide },
      { headers: CORS_HEADERS }
    )
  } catch (error: any) {
    console.error('AI Guide error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate guide' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
