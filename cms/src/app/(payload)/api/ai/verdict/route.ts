import { NextRequest, NextResponse } from 'next/server'

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const VERDICT_SYSTEM_PROMPT = `You are a veteran pet product reviewer for PawLabs. You're writing a comprehensive comparison verdict for multiple products in the same category.

YOUR TASK: Analyze all the provided products and write a well-reasoned verdict that helps pet parents choose the right product.

YOUR ANALYSIS MUST CONSIDER:
1. **Price & Value** — Is the price justified? What's the cost-per-feature ratio?
2. **Ratings & Reviews** — What do ratings and user feedback reveal?
3. **Pros & Cons** — Weight the severity of each con and the significance of each pro
4. **Who It's For** — Different products suit different owners (budget-conscious, premium seekers, first-time pet parents, multi-pet households, etc.)
5. **Overall Winner** — Declare a clear winner, but explain WHY and for WHOM

YOUR WRITING STYLE:
- Write like a real person. You have opinions. Strong ones.
- Be specific. Reference actual data from the products (prices, specific pros/cons).
- Don't hedge. Make a clear recommendation.
- Address trade-offs honestly: "Yes, it's $200 more, but here's why that matters..."
- Keep it focused: 200-400 words of flowing prose.

RESPONSE FORMAT:
Return ONLY valid HTML (no markdown, no code fences). Use these tags:
- <h3> for section headers (e.g., "The Clear Winner", "Best Value Pick", "Who Should Buy What")
- <p> for paragraphs
- <strong> for emphasis on product names and key phrases
- Do NOT wrap in any outer container divs`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { products } = body

    if (!products || !Array.isArray(products) || products.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 products are required for comparison' },
        { status: 400 },
      )
    }

    const apiKey = process.env.XAI_API_KEY
    if (!apiKey || apiKey === 'your-xai-api-key-here') {
      return NextResponse.json(
        { error: 'XAI_API_KEY is not configured' },
        { status: 500 },
      )
    }

    // Build a detailed product summary for Grok
    const productSummaries = products.map((p: any, i: number) => {
      const pros = p.pros?.map((pr: any) => pr.point).join(', ') || 'None listed'
      const cons = p.cons?.map((c: any) => c.point).join(', ') || 'None listed'
      const reviews = p.reviews?.map((r: any) => `"${r.title}" (${r.overallRating}/5): ${r.summary}`).join('\n    ') || 'No user reviews'

      return `
  PRODUCT ${i + 1}: ${p.name}
    Price: ${p.price != null ? `$${p.price.toFixed(2)}` : 'Unknown'}
    Rating: ${p.rating != null ? `${p.rating}/5` : 'Unrated'}
    Category: ${p.category || 'Unknown'}
    Pet Type: ${p.petType || 'Universal'}
    Pros: ${pros}
    Cons: ${cons}
    Short Description: ${p.shortDescription || 'None'}
    User Reviews: ${reviews}`
    }).join('\n')

    const userPrompt = `Compare these ${products.length} pet products and write your verdict:
${productSummaries}

Remember: Pick a winner. Be specific about WHY. Consider every factor: price, rating, pros, cons, user reviews, and overall value. Different budgets and needs may lead to different recommendations — address this.`

    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-fast',
        messages: [
          { role: 'system', content: VERDICT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.75,
        max_tokens: 2048,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Grok API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('Grok returned empty response')
    }

    // Clean up any accidental markdown wrapping
    let html = content.trim()
    if (html.startsWith('```')) {
      html = html.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '')
    }

    return NextResponse.json({ success: true, verdict: html }, { headers: CORS_HEADERS })
  } catch (error: any) {
    console.error('AI Verdict error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate verdict' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
