import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Products } from './collections/Products'
import { Reviews } from './collections/Reviews'
import { Verdicts } from './collections/Verdicts'
import { Guides } from './collections/Guides'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' | PawLabs CMS',
    },
    components: {
      views: {
        aiGenerate: {
          Component: '/components/AIGenerateView',
          path: '/ai-generate',
          meta: {
            title: 'AI Generate',
            description: 'Generate products from affiliate links using Grok AI',
          },
        },
        aiGuide: {
          Component: '/components/AIGuideView',
          path: '/ai-guide',
          meta: {
            title: 'AI Guide Generator',
            description: 'Generate multi-product guides and roundups using Grok AI',
          },
        },
      },
      afterNavLinks: ['/components/AINavLink'],
    },
  },
  collections: [Users, Media, Products, Reviews, Verdicts, Guides],
  plugins: [],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || 'postgresql://localhost:5432/pawlabs',
    },
  }),
  sharp,
  endpoints: [
    {
      path: '/ai/verdict',
      method: 'post',
      handler: async (req) => {
        const CORS = { 'Access-Control-Allow-Origin': '*' };
        try {
          const rawBody = await req.json();
          const products = rawBody?.products;
          const slugs = rawBody?.slugs;

          if (!products || !Array.isArray(products) || products.length < 2) {
            return Response.json(
              { error: 'At least 2 products are required for comparison' },
              { status: 400, headers: CORS }
            );
          }

          // Build cache key from sorted slugs
          const productSlugs = (slugs && Array.isArray(slugs)) ? slugs : products.map((p: any) => p.slug).filter(Boolean);
          const productKey = [...productSlugs].sort().join(',');

          // Check cache first
          if (productKey) {
            try {
              const cached = await req.payload.find({
                collection: 'verdicts',
                where: { productKey: { equals: productKey } },
                limit: 1,
              });
              if (cached.docs.length > 0) {
                console.log('Verdict cache HIT for:', productKey);
                return Response.json(
                  { success: true, verdict: cached.docs[0].verdict, cached: true },
                  { headers: CORS }
                );
              }
              console.log('Verdict cache MISS for:', productKey);
            } catch (cacheErr) {
              console.warn('Cache lookup failed, generating fresh:', cacheErr);
            }
          }

          const apiKey = process.env.XAI_API_KEY;
          if (!apiKey || apiKey === 'your-xai-api-key-here') {
            return Response.json(
              { error: 'XAI_API_KEY is not configured' },
              { status: 500, headers: CORS }
            );
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
- <h3> for section headers
- <p> for paragraphs
- <strong> for emphasis`;

          const productSummaries = products.map((p: any, i: number) => {
            const pros = p.pros?.map((pr: any) => pr.point).join(', ') || 'None listed';
            const cons = p.cons?.map((c: any) => c.point).join(', ') || 'None listed';
            const reviews = p.reviews?.map((r: any) => '"' + r.title + '" (' + r.overallRating + '/5): ' + r.summary).join('\n    ') || 'No user reviews';

            return '\nPRODUCT ' + (i + 1) + ': ' + p.name +
              '\n    Price: ' + (p.price != null ? '$' + p.price.toFixed(2) : 'Unknown') +
              '\n    Rating: ' + (p.rating != null ? p.rating + '/5' : 'Unrated') +
              '\n    Category: ' + (p.category || 'Unknown') +
              '\n    Pet Type: ' + (p.petType || 'Universal') +
              '\n    Pros: ' + pros +
              '\n    Cons: ' + cons +
              '\n    Short Description: ' + (p.shortDescription || 'None') +
              '\n    User Reviews: ' + reviews;
          }).join('\n');

          const userPrompt = 'Compare these ' + products.length + ' pet products and write your verdict:\n' + productSummaries + '\n\nRemember: Pick a winner. Be specific about WHY. Consider every factor: price, rating, pros, cons, user reviews, and overall value.';

          const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + apiKey,
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
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error('Grok API error (' + response.status + '): ' + errorText);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;

          if (!content) throw new Error('Grok returned empty response');

          let html = content.trim();
          if (html.startsWith('```')) {
            html = html.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '');
          }

          // Save to cache
          if (productKey) {
            try {
              await req.payload.create({
                collection: 'verdicts',
                data: {
                  productKey,
                  verdict: html,
                  productSlugs: productSlugs,
                  category: products[0]?.category || '',
                },
              });
              console.log('Verdict cached for:', productKey);
            } catch (saveErr) {
              console.warn('Failed to cache verdict:', saveErr);
            }
          }

          return Response.json(
            { success: true, verdict: html, cached: false },
            { headers: CORS }
          );
        } catch (error: any) {
          console.error('AI Verdict error:', error);
          return Response.json(
            { error: error.message || 'Failed to generate verdict' },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
          );
        }
      }
    },
    {
      path: '/ai/generate',
      method: 'post',
      handler: async (req) => {
        const CORS = { 'Access-Control-Allow-Origin': '*' };
        try {
          if (!req.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
          }

          const rawBody = await req.json();
          const { url, context, action } = rawBody || {};

          if (!url) {
            return Response.json({ error: 'URL is required' }, { status: 400, headers: CORS });
          }

          // Import lib dynamically since this file is part of config
          const { generateWithGrok } = await import('./lib/grok');
          const product = await generateWithGrok(url, context);

          if (action === 'save') {
            const saved = await req.payload.create({
              collection: 'products',
              data: product,
            });
            return Response.json({ success: true, saved }, { headers: CORS });
          }

          return Response.json({ success: true, product }, { headers: CORS });
        } catch (error: any) {
          console.error('AI Generate error:', error);
          return Response.json(
            { error: error.message || 'Failed to generate product' },
            { status: 500, headers: CORS }
          );
        }
      }
    },
    {
      path: '/ai/generate',
      method: 'options',
      handler: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        });
      }
    },
    {
      path: '/ai/verdict',
      method: 'options',
      handler: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        });
      }
    }
  ],
})
