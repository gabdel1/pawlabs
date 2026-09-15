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
import { QuizQuestions } from './collections/QuizQuestions'
import { QuizSubmissions } from './collections/QuizSubmissions'
import { ContentPlan } from './collections/ContentPlan'
import { subscribeToBrevo } from './lib/brevo'

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
        aiQuiz: {
          Component: '/components/AIQuizQuestionView',
          path: '/ai-quiz',
          meta: {
            title: 'AI Quiz Questions',
            description: 'Draft Breed Match quiz questions from notes using Grok AI',
          },
        },
      },
      afterNavLinks: ['/components/AINavLink'],
    },
  },
  collections: [Users, Media, Breeds, Comparisons, QuizQuestions, QuizSubmissions, ContentPlan],
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
        let body: Record<string, unknown>
        try {
          body = await req.json() as Record<string, unknown>
        } catch {
          return Response.json(
            { error: 'Invalid request body' },
            { status: 400, headers: CORS },
          )
        }

        const email = typeof body.email === 'string' ? body.email : ''

        const attributes: Record<string, string> = {}
        if (typeof body.source === 'string') attributes.SOURCE = body.source
        if (typeof body.breed === 'string') attributes.BREED = body.breed

        const result = await subscribeToBrevo(email, attributes)
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status, headers: CORS })
        }
        return Response.json(
          result.existing ? { ok: true, existing: true } : { ok: true },
          { headers: CORS },
        )
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
