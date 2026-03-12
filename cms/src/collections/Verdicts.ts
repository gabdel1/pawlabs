import type { CollectionConfig } from 'payload'

export const Verdicts: CollectionConfig = {
  slug: 'verdicts',
  admin: {
    useAsTitle: 'productKey',
    defaultColumns: ['productKey', 'category', 'createdAt'],
    description: 'Cached AI verdicts for product comparisons',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'productKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Product Key',
      admin: {
        description: 'Sorted, comma-joined product slugs (e.g. "product-a,product-b")',
      },
    },
    {
      name: 'verdict',
      type: 'textarea',
      required: true,
      label: 'Verdict HTML',
      admin: {
        description: 'The AI-generated HTML verdict',
      },
    },
    {
      name: 'productSlugs',
      type: 'json',
      label: 'Product Slugs',
      admin: {
        description: 'Array of product slugs used in this comparison',
      },
    },
    {
      name: 'category',
      type: 'text',
      label: 'Category',
      admin: {
        description: 'Product category for this comparison',
      },
    },
  ],
}
