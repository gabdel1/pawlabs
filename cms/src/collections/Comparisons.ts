import type { CollectionConfig } from 'payload'

export const Comparisons: CollectionConfig = {
  slug: 'comparisons',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'publishedDate'],
    description: 'AI-generated head-to-head dog breed comparisons',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Comparison Title',
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
      label: 'Comparison Content (HTML)',
      admin: {
        description: 'Full article body as HTML',
      },
    },
    {
      name: 'breeds',
      type: 'relationship',
      relationTo: 'breeds',
      hasMany: true,
      required: true,
      label: 'Compared Breeds',
      admin: {
        description: 'The breeds compared in this article (at least two)',
      },
    },
    {
      name: 'comparisonCriteria',
      type: 'array',
      label: 'Comparison Criteria',
      admin: {
        description: 'Trait keys used by the comparison table. Leave empty to use defaults.',
      },
      fields: [
        {
          name: 'criterion',
          type: 'select',
          required: true,
          options: [
            { label: 'Low Shedding', value: 'lowShedding' },
            { label: 'Apartment Friendly', value: 'apartmentFriendly' },
            { label: 'Watchdog Ability', value: 'watchdogAbility' },
            { label: 'Energy Level', value: 'energyLevel' },
            { label: 'Trainability', value: 'trainability' },
            { label: 'Child Friendly', value: 'childFriendly' },
            { label: 'Pet Friendly', value: 'petFriendly' },
            { label: 'Easy Grooming', value: 'easyGrooming' },
            { label: 'Barking Control', value: 'barkingControl' },
            { label: 'Adaptability', value: 'adaptability' },
            { label: 'Intelligence', value: 'intelligence' },
            { label: 'Health Robustness', value: 'healthRobustness' },
          ],
        },
      ],
    },
    {
      name: 'verdict',
      type: 'textarea',
      label: 'Final Verdict (HTML)',
      admin: {
        description: 'Closing verdict block shown below the comparison table.',
      },
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
