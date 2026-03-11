import type { CollectionConfig } from 'payload'
import { triggerRedeploy } from '../hooks/triggerRedeploy'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'petType', 'featured', 'rating'],
    description: 'Pet products for affiliate marketing reviews',
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [triggerRedeploy],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Product Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'URL-friendly identifier (e.g. smart-pet-feeder)',
      },
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Full Description',
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      label: 'Short Description',
      admin: {
        description: 'Brief summary for product cards and SEO meta descriptions',
      },
    },
    {
      name: 'price',
      type: 'number',
      label: 'Price ($)',
      admin: {
        position: 'sidebar',
        description: 'Current retail price',
      },
    },
    {
      name: 'affiliateUrl',
      type: 'text',
      label: 'Affiliate URL',
      admin: {
        description: 'Affiliate link (Amazon, Chewy, etc.)',
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Main Image',
    },
    {
      name: 'gallery',
      type: 'array',
      label: 'Image Gallery',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
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
      name: 'featured',
      type: 'checkbox',
      label: 'Featured Product',
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'rating',
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
      name: 'pros',
      type: 'array',
      label: 'Pros',
      fields: [
        {
          name: 'point',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'cons',
      type: 'array',
      label: 'Cons',
      fields: [
        {
          name: 'point',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
