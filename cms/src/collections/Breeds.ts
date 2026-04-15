import type { CollectionConfig } from 'payload'

/** Rating trait field helper — 1-10 scale for bar chart display */
function traitField(name: string, label: string, description: string) {
  return {
    name,
    type: 'number' as const,
    label,
    min: 1,
    max: 10,
    admin: {
      description: `${description} (1 = lowest, 10 = highest)`,
    },
  }
}

export const Breeds: CollectionConfig = {
  slug: 'breeds',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'petType', 'breedGroup', 'size', 'status'],
    description: 'Dog and cat breed profiles with detailed traits and ratings',
  },
  access: {
    read: () => true,
  },
  fields: [
    // ── Core Info ──────────────────────────────────────────
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Breed Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'URL-friendly identifier (e.g. golden-retriever)',
      },
    },
    {
      name: 'petType',
      type: 'select',
      required: true,
      label: 'Pet Type',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Dog', value: 'dog' },
        { label: 'Cat', value: 'cat' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Featured Breed',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Breed Image',
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      label: 'Short Description',
      admin: {
        description: 'One-liner for cards and SEO (max 160 chars)',
      },
    },

    // ── Breed Overview ─────────────────────────────────────
    {
      name: 'breedGroup',
      type: 'select',
      label: 'Breed Group',
      options: [
        { label: 'Sporting', value: 'sporting' },
        { label: 'Working', value: 'working' },
        { label: 'Herding', value: 'herding' },
        { label: 'Toy', value: 'toy' },
        { label: 'Terrier', value: 'terrier' },
        { label: 'Hound', value: 'hound' },
        { label: 'Non-Sporting', value: 'non-sporting' },
        { label: 'Foundation Stock', value: 'foundation-stock' },
        // Cat-specific groups
        { label: 'Natural', value: 'natural' },
        { label: 'Hybrid', value: 'hybrid' },
        { label: 'Mutation', value: 'mutation' },
        { label: 'Crossbreed', value: 'crossbreed' },
      ],
    },
    {
      name: 'size',
      type: 'select',
      label: 'Size Category',
      options: [
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' },
        { label: 'Giant', value: 'giant' },
      ],
    },
    {
      name: 'heightMin',
      type: 'number',
      label: 'Height Min (inches)',
    },
    {
      name: 'heightMax',
      type: 'number',
      label: 'Height Max (inches)',
    },
    {
      name: 'weightMin',
      type: 'number',
      label: 'Weight Min (lbs)',
    },
    {
      name: 'weightMax',
      type: 'number',
      label: 'Weight Max (lbs)',
    },
    {
      name: 'lifeExpectancyMin',
      type: 'number',
      label: 'Life Expectancy Min (years)',
    },
    {
      name: 'lifeExpectancyMax',
      type: 'number',
      label: 'Life Expectancy Max (years)',
    },
    {
      name: 'coatType',
      type: 'select',
      label: 'Coat Type',
      options: [
        { label: 'Smooth', value: 'smooth' },
        { label: 'Double', value: 'double' },
        { label: 'Wire', value: 'wire' },
        { label: 'Curly', value: 'curly' },
        { label: 'Silky', value: 'silky' },
        { label: 'Hairless', value: 'hairless' },
        { label: 'Long', value: 'long' },
        { label: 'Short', value: 'short' },
        { label: 'Medium', value: 'medium' },
        { label: 'Rough', value: 'rough' },
      ],
    },
    {
      name: 'coatLength',
      type: 'select',
      label: 'Coat Length',
      options: [
        { label: 'Short', value: 'short' },
        { label: 'Medium', value: 'medium' },
        { label: 'Long', value: 'long' },
        { label: 'Hairless', value: 'hairless' },
      ],
    },
    {
      name: 'colors',
      type: 'array',
      label: 'Coat Colors',
      fields: [
        {
          name: 'color',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'origin',
      type: 'text',
      label: 'Country/Region of Origin',
    },
    {
      name: 'breedRole',
      type: 'text',
      label: 'Breed Role / Original Purpose',
      admin: {
        description: 'e.g. "Retrieving game", "Herding sheep", "Companion"',
      },
    },
    {
      name: 'temperament',
      type: 'array',
      label: 'Temperament Tags',
      admin: {
        description: 'Key temperament descriptors (e.g. Loyal, Energetic, Gentle)',
      },
      fields: [
        {
          name: 'trait',
          type: 'text',
          required: true,
        },
      ],
    },

    // ── Strengths & Weaknesses ─────────────────────────────
    {
      name: 'strengths',
      type: 'array',
      label: 'Strengths',
      fields: [
        {
          name: 'point',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'weaknesses',
      type: 'array',
      label: 'Weaknesses',
      fields: [
        {
          name: 'point',
          type: 'text',
          required: true,
        },
      ],
    },

    // ── Trait Ratings (1-10 bar chart) ─────────────────────
    {
      name: 'traits',
      type: 'group',
      label: 'Trait Ratings',
      admin: {
        description: 'Rate each trait from 1 (lowest) to 10 (highest). These power the breed comparison charts.',
      },
      fields: [
        traitField('affectionLevel', 'Affection Level', 'How loving and cuddly with family'),
        traitField('childFriendly', 'Child Friendly', 'Patience and safety around children'),
        traitField('petFriendly', 'Pet Friendly', 'Gets along with other dogs and cats'),
        traitField('strangerFriendly', 'Stranger Friendly', 'How they react to new people'),
        traitField('trainability', 'Trainability', 'Ease of training and willingness to learn'),
        traitField('energyLevel', 'Energy Level', 'Daily energy and exercise requirements'),
        traitField('groomingNeeds', 'Grooming Needs', 'Amount of grooming and maintenance required'),
        traitField('sheddingLevel', 'Shedding Level', 'How much they shed'),
        traitField('barkingLevel', 'Barking Level', 'Tendency to bark or vocalize'),
        traitField('intelligence', 'Intelligence', 'Problem-solving ability and learning speed'),
        traitField('playfulness', 'Playfulness', 'Play drive and fun factor'),
        traitField('watchdogAbility', 'Watchdog Ability', 'Alertness and protective instincts'),
        traitField('adaptability', 'Adaptability', 'Adjusting to new environments and changes'),
        traitField('healthRobustness', 'Health Robustness', 'Overall genetic health and disease resistance'),
      ],
    },

    // ── Content ────────────────────────────────────────────
    {
      name: 'breedHistory',
      type: 'textarea',
      label: 'Breed History',
      admin: {
        description: 'HTML content covering the breed\'s origin story and history',
      },
    },
    {
      name: 'article',
      type: 'textarea',
      label: 'Full Article',
      admin: {
        description: 'HTML article covering all traits in detail — temperament, health, exercise, diet, grooming, training, living conditions, and who this breed is for',
      },
    },

    // ── Meta ───────────────────────────────────────────────
    {
      name: 'author',
      type: 'text',
      label: 'Author',
      defaultValue: 'PawLabs Team',
      admin: { position: 'sidebar' },
    },
    {
      name: 'publishedDate',
      type: 'date',
      label: 'Published Date',
      admin: { position: 'sidebar' },
    },
  ],
}
