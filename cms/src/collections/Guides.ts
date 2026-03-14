import type { CollectionConfig } from 'payload'

export const Guides: CollectionConfig = {
  slug: 'guides',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'guideType', 'category', 'status', 'publishedDate'],
    description: 'AI-generated multi-product guides and roundups',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Guide Title',
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
      name: 'guideType',
      type: 'select',
      label: 'Guide Type',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'Ultimate Guide', value: 'ultimate-guide' },
        { label: 'Essentials Roundup', value: 'essentials' },
        { label: 'Product Roundup', value: 'roundup' },
        { label: 'Comparison Guide', value: 'comparison' },
      ],
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
      name: 'content',
      type: 'textarea',
      label: 'Guide Content (HTML)',
      admin: {
        description: 'Full guide body as HTML',
      },
    },
    {
      name: 'products',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      required: true,
      label: 'Featured Products',
      admin: {
        description: 'Products featured in this guide',
      },
    },
    {
      name: 'category',
      type: 'select',
      label: 'Category',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'Smart Gadgets', value: 'smart-gadgets' },
        { label: 'Toys', value: 'toys' },
        { label: 'Food & Treats', value: 'food-treats' },
        { label: 'Health & Wellness', value: 'health-wellness' },
        { label: 'Grooming', value: 'grooming' },
        { label: 'Beds & Furniture', value: 'beds-furniture' },
        { label: 'Leashes & Collars', value: 'leashes-collars' },
        { label: 'Travel', value: 'travel' },
        { label: 'Mixed', value: 'mixed' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'petType',
      type: 'select',
      label: 'Pet Type',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'Dog', value: 'dog' },
        { label: 'Cat', value: 'cat' },
        { label: 'Bird', value: 'bird' },
        { label: 'Fish', value: 'fish' },
        { label: 'Small Animal', value: 'small-animal' },
        { label: 'Reptile', value: 'reptile' },
        { label: 'Universal', value: 'universal' },
      ],
    },
    {
      name: 'author',
      type: 'text',
      label: 'Author',
      defaultValue: 'PawLabs Team',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Featured Image',
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
