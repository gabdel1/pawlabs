import type { CollectionConfig } from 'payload'
import { slugifyFilename } from '../lib/slugify-filename'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  upload: true,
  hooks: {
    /**
     * Slugify the filename before Payload writes the file.
     *
     * Uploads used to keep their original names, so "Belgian Malinois.png"
     * became /media/Belgian Malinois — an unencoded space that crawlers
     * truncate. Normalising at the door means the URL is always safe, and
     * Payload still handles collisions by appending its own -1, -2 suffix.
     */
    beforeOperation: [
      ({ req, operation }) => {
        if (operation !== 'create' && operation !== 'update') return
        const file = req.file
        if (!file?.name) return
        file.name = slugifyFilename(file.name, file.mimetype)
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
}
