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
      },
      afterNavLinks: ['/components/AINavLink'],
    },
  },
  collections: [Users, Media, Products, Reviews],
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
  plugins: [],
})

