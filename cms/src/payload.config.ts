import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Breeds } from './collections/Breeds'
import { Comparisons } from './collections/Comparisons'

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
        aiBreed: {
          Component: '/components/AIBreedView',
          path: '/ai-breed',
          meta: {
            title: 'AI Breed Generator',
            description: 'Generate breed profiles with traits and ratings using Grok AI',
          },
        },
        aiBreedCompare: {
          Component: '/components/AIBreedCompareView',
          path: '/ai-breed-compare',
          meta: {
            title: 'AI Breed Compare',
            description: 'Generate breed comparisons with a comparison table and verdict using Grok AI',
          },
        },
      },
      afterNavLinks: ['/components/AINavLink'],
    },
  },
  collections: [Users, Media, Breeds, Comparisons],
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
    // Newsletter subscribe
    {
      path: '/subscribe',
      method: 'post',
      handler: async (req) => {
        const CORS = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
        const BREVO_API_KEY = process.env.BREVO_API_KEY
        if (!BREVO_API_KEY) {
          return Response.json(
            { error: 'Email service not configured' },
            { status: 500, headers: CORS },
          )
        }

        let body: Record<string, unknown>
        try {
          body = await req.json() as Record<string, unknown>
        } catch {
          return Response.json(
            { error: 'Invalid request body' },
            { status: 400, headers: CORS },
          )
        }

        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return Response.json(
            { error: 'A valid email address is required' },
            { status: 400, headers: CORS },
          )
        }

        const attributes: Record<string, string> = {}
        if (typeof body.source === 'string') attributes.SOURCE = body.source
        if (typeof body.breed === 'string') attributes.BREED = body.breed

        try {
          const res = await fetch('https://api.brevo.com/v3/contacts', {
            method: 'POST',
            headers: {
              'api-key': BREVO_API_KEY,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              email,
              attributes,
              updateEnabled: true,
            }),
          })

          if (res.status === 201 || res.status === 204) {
            return Response.json({ ok: true }, { headers: CORS })
          }

          const data = await res.json().catch(() => ({})) as Record<string, unknown>
          if (
            res.status === 400 &&
            typeof data.message === 'string' &&
            data.message.toLowerCase().includes('already exist')
          ) {
            return Response.json({ ok: true, existing: true }, { headers: CORS })
          }

          console.error('[subscribe] Brevo error:', res.status, data)
          return Response.json(
            { error: 'Subscription failed. Please try again.' },
            { status: 502, headers: CORS },
          )
        } catch (err) {
          console.error('[subscribe] Network error:', err)
          return Response.json(
            { error: 'Service unavailable. Please try again later.' },
            { status: 503, headers: CORS },
          )
        }
      }
    },
    {
      path: '/subscribe',
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
  ],
})
