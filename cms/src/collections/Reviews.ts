import type { CollectionConfig } from 'payload'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'product', 'overallRating', 'verdict', 'status'],
    description: 'In-depth product reviews for affiliate content',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Review Title',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'URL-friendly identifier',
      },
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      label: 'Product',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Review Content',
      admin: {
        description: 'Full in-depth review body',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      label: 'Summary',
      admin: {
        description: 'Short excerpt for SEO meta descriptions and cards',
      },
    },
    {
      name: 'overallRating',
      type: 'number',
      label: 'Overall Rating',
      min: 0,
      max: 5,
      admin: {
        position: 'sidebar',
        description: 'Rating out of 5 stars',
      },
    },
    {
      name: 'ratingBreakdown',
      type: 'group',
      label: 'Rating Breakdown',
      fields: [
        {
          name: 'quality',
          type: 'number',
          label: 'Quality',
          min: 0,
          max: 5,
        },
        {
          name: 'valueForMoney',
          type: 'number',
          label: 'Value for Money',
          min: 0,
          max: 5,
        },
        {
          name: 'easeOfUse',
          type: 'number',
          label: 'Ease of Use',
          min: 0,
          max: 5,
        },
        {
          name: 'durability',
          type: 'number',
          label: 'Durability',
          min: 0,
          max: 5,
        },
      ],
    },
    {
      name: 'verdict',
      type: 'select',
      label: 'Verdict',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'Highly Recommended', value: 'highly-recommended' },
        { label: 'Recommended', value: 'recommended' },
        { label: 'Average', value: 'average' },
        { label: 'Not Recommended', value: 'not-recommended' },
      ],
    },
    {
      name: 'affiliateUrl',
      type: 'text',
      label: 'Affiliate URL',
      admin: {
        description: 'Override the product affiliate link for this specific review',
      },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Featured Image',
    },
    {
      name: 'author',
      type: 'text',
      label: 'Author',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishedDate',
      type: 'date',
      label: 'Published Date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      defaultValue: 'draft',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
  ],
}
