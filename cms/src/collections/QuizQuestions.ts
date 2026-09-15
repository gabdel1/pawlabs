import type { CollectionConfig } from 'payload'

/**
 * Questions that power the Breed Match quiz on the site.
 *
 * Each option carries trait weights: a target score (1-10) for one of the 14
 * breed traits plus how strongly that answer should pull the match. The public
 * /api/quiz/match endpoint uses those weights to score every published breed
 * deterministically, then hands the strongest candidates to Grok for the final
 * pick and the personalised write-up.
 *
 * Questions are editable here by hand, or drafted from free-text notes at
 * /admin/ai-quiz (notes from the team, or the "anything else?" notes quiz
 * takers leave at the end of a run).
 */

/** Must match the trait keys on the Breeds collection. */
export const TRAIT_OPTIONS = [
  { label: 'Affection Level', value: 'affectionLevel' },
  { label: 'Child Friendly', value: 'childFriendly' },
  { label: 'Pet Friendly', value: 'petFriendly' },
  { label: 'Stranger Friendly', value: 'strangerFriendly' },
  { label: 'Trainability', value: 'trainability' },
  { label: 'Energy Level', value: 'energyLevel' },
  { label: 'Grooming Needs', value: 'groomingNeeds' },
  { label: 'Shedding Level', value: 'sheddingLevel' },
  { label: 'Barking Level', value: 'barkingLevel' },
  { label: 'Intelligence', value: 'intelligence' },
  { label: 'Playfulness', value: 'playfulness' },
  { label: 'Watchdog Ability', value: 'watchdogAbility' },
  { label: 'Adaptability', value: 'adaptability' },
  { label: 'Health Robustness', value: 'healthRobustness' },
]

const SIZE_OPTIONS = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
  { label: 'Giant', value: 'giant' },
]

export const QuizQuestions: CollectionConfig = {
  slug: 'quiz-questions',
  labels: {
    singular: 'Quiz Question',
    plural: 'Quiz Questions',
  },
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question', 'key', 'order', 'petScope', 'type', 'status'],
    description: 'Questions for the Breed Match quiz, with trait weights per answer',
    listSearchableFields: ['question', 'key'],
  },
  access: {
    read: () => true,
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'question',
      type: 'text',
      required: true,
      label: 'Question',
      admin: {
        description: 'The question as the visitor reads it. Keep it conversational.',
      },
    },
    {
      name: 'helper',
      type: 'text',
      label: 'Helper Text',
      admin: {
        description: 'Optional one-liner under the question — context, or permission to be honest.',
      },
    },
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'Machine key used in stored answers (e.g. household-energy). Do not reuse.',
      },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 100,
      admin: {
        position: 'sidebar',
        description: 'Lower numbers are asked first.',
      },
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
      name: 'petScope',
      type: 'select',
      defaultValue: 'both',
      label: 'Ask For',
      admin: {
        position: 'sidebar',
        description: 'Only ask this question when the visitor is after this kind of pet.',
      },
      options: [
        { label: 'Dogs & Cats', value: 'both' },
        { label: 'Dogs Only', value: 'dog' },
        { label: 'Cats Only', value: 'cat' },
      ],
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'single',
      label: 'Answer Type',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Pick One', value: 'single' },
        { label: 'Pick Several', value: 'multi' },
        { label: 'Free Text', value: 'text' },
      ],
    },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'grid',
      label: 'Option Layout',
      admin: {
        position: 'sidebar',
        description: 'Grid for 4-6 rich options, list for wordy ones, scale for a 1-5 style row.',
      },
      options: [
        { label: 'Grid', value: 'grid' },
        { label: 'List', value: 'list' },
        { label: 'Scale', value: 'scale' },
      ],
    },
    {
      name: 'emoji',
      type: 'text',
      label: 'Question Emoji',
      admin: {
        position: 'sidebar',
        description: 'Shown above the question. One emoji.',
      },
    },
    {
      name: 'required',
      type: 'checkbox',
      defaultValue: true,
      label: 'Answer Required',
      admin: { position: 'sidebar' },
    },
    {
      name: 'maxSelections',
      type: 'number',
      label: 'Max Selections',
      admin: {
        position: 'sidebar',
        description: 'Pick Several only. Leave blank for no limit.',
        condition: (data) => data?.type === 'multi',
      },
    },
    {
      name: 'placeholder',
      type: 'text',
      label: 'Input Placeholder',
      admin: {
        description: 'Free Text only.',
        condition: (data) => data?.type === 'text',
      },
    },
    {
      name: 'options',
      type: 'array',
      label: 'Answer Options',
      admin: {
        description: 'Each option nudges the match via its trait weights.',
        condition: (data) => data?.type !== 'text',
        initCollapsed: true,
        components: {
          RowLabel: '/components/QuizOptionRowLabel',
        },
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          admin: { description: 'What the visitor clicks.' },
        },
        {
          name: 'value',
          type: 'text',
          required: true,
          admin: { description: 'Stored value (e.g. couch-potato).' },
        },
        {
          name: 'emoji',
          type: 'text',
          admin: { description: 'One emoji for the option tile.' },
        },
        {
          name: 'description',
          type: 'text',
          admin: { description: 'Optional half-sentence under the label.' },
        },
        {
          name: 'weights',
          type: 'array',
          label: 'Trait Weights',
          admin: {
            description: 'How this answer should shape the match.',
            initCollapsed: true,
          },
          fields: [
            {
              name: 'trait',
              type: 'select',
              required: true,
              options: TRAIT_OPTIONS,
            },
            {
              name: 'target',
              type: 'number',
              required: true,
              min: 1,
              max: 10,
              defaultValue: 5,
              admin: { description: 'The ideal score for this trait, 1-10.' },
            },
            {
              name: 'weight',
              type: 'number',
              required: true,
              min: 1,
              max: 5,
              defaultValue: 3,
              admin: { description: 'How much this matters, 1 (nudge) to 5 (dealbreaker).' },
            },
          ],
        },
        {
          name: 'prefersSizes',
          type: 'select',
          hasMany: true,
          label: 'Favours Sizes',
          options: SIZE_OPTIONS,
          admin: {
            description: 'Optional — breeds in these size bands get a bonus for this answer.',
          },
        },
      ],
    },

    // ── Provenance ─────────────────────────────────────────
    {
      name: 'sourceNote',
      type: 'textarea',
      label: 'Source Note',
      admin: {
        description: 'The note this question was drafted from. Kept for context when reviewing.',
      },
    },
    {
      name: 'aiGenerated',
      type: 'checkbox',
      defaultValue: false,
      label: 'Drafted by AI',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
