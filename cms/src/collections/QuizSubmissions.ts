import type { CollectionConfig } from 'payload'

/**
 * A completed run of the Breed Match quiz.
 *
 * Written only by the public /api/quiz/match endpoint through the local API —
 * REST create is closed so nobody can seed this collection from outside.
 *
 * The `note` field is where quiz takers tell us what the questions failed to
 * ask. /admin/ai-quiz reads those notes back and drafts new questions from them.
 */
export const QuizSubmissions: CollectionConfig = {
  slug: 'quiz-submissions',
  labels: {
    singular: 'Quiz Submission',
    plural: 'Quiz Submissions',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'petType', 'topBreedName', 'subscribed', 'createdAt'],
    description: 'Completed Breed Match quiz runs, with the answers and what we recommended',
    listSearchableFields: ['email', 'topBreedName', 'note'],
  },
  access: {
    // Created server-side via the local API only.
    create: () => false,
  },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      admin: { description: 'Blank when the visitor skipped the email step.' },
    },
    {
      name: 'subscribed',
      type: 'checkbox',
      defaultValue: false,
      label: 'Opted Into Newsletter',
      admin: { position: 'sidebar' },
    },
    {
      name: 'petType',
      type: 'select',
      label: 'Looking For',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Dog', value: 'dog' },
        { label: 'Cat', value: 'cat' },
        { label: 'Either', value: 'either' },
      ],
    },
    {
      name: 'matchedBy',
      type: 'select',
      label: 'Matched By',
      admin: {
        position: 'sidebar',
        description: 'Fallback means Grok was unavailable and trait scoring decided the result.',
      },
      options: [
        { label: 'Grok', value: 'ai' },
        { label: 'Trait Scoring (fallback)', value: 'fallback' },
      ],
    },
    {
      name: 'topBreedName',
      type: 'text',
      label: 'Top Match',
      admin: { readOnly: true },
    },
    {
      name: 'recommendedBreeds',
      type: 'relationship',
      relationTo: 'breeds',
      hasMany: true,
      label: 'Recommended Breeds',
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Visitor Note',
      admin: {
        description: 'Free-text the visitor added at the end. Raw material for new questions.',
      },
    },
    {
      name: 'answers',
      type: 'json',
      label: 'Answers',
      admin: {
        description: 'Every question asked and what they picked.',
      },
    },
    {
      name: 'result',
      type: 'json',
      label: 'Result',
      admin: {
        description: 'The full match payload returned to the visitor.',
      },
    },
    {
      name: 'source',
      type: 'text',
      label: 'Source',
      admin: {
        position: 'sidebar',
        description: 'Where the quiz was started from.',
      },
    },
  ],
}
