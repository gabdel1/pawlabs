import type { CollectionConfig } from 'payload'

/**
 * The editorial calendar the daily job works through.
 *
 * One row per planned article, roughly one per day for a year. Rows are
 * generated in bulk by the planner, then curated by hand — delete the ideas you
 * do not want, reorder by changing the scheduled date, or add your own.
 *
 * The daily job takes the next queued item that is due, generates it, and links
 * the article it produced back here.
 */
export const ContentPlan: CollectionConfig = {
  slug: 'content-plan',
  labels: { singular: 'Planned Article', plural: 'Content Plan' },
  admin: {
    useAsTitle: 'workingTitle',
    defaultColumns: ['workingTitle', 'style', 'scheduledFor', 'status', 'score'],
    description: 'The rolling plan of articles the daily generator works through',
    listSearchableFields: ['workingTitle', 'angleKey', 'reason'],
  },
  access: { read: () => true },
  defaultSort: 'scheduledFor',
  fields: [
    {
      name: 'workingTitle',
      type: 'text',
      required: true,
      label: 'Working Title',
      admin: { description: 'A placeholder. The writer produces the real headline.' },
    },
    {
      name: 'style',
      type: 'select',
      required: true,
      admin: { position: 'sidebar' },
      options: [
        { label: 'Head to head (2 breeds)', value: 'head-to-head' },
        { label: 'Three-way (3 breeds)', value: 'three-way' },
        { label: 'Best breed for… (roundup)', value: 'best-for' },
        { label: 'Group roundup', value: 'group-roundup' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'queued',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Generated', value: 'generated' },
        { label: 'Skipped', value: 'skipped' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'scheduledFor',
      type: 'date',
      label: 'Scheduled For',
      admin: {
        position: 'sidebar',
        description: 'The daily job picks the oldest queued item due on or before today.',
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'score',
      type: 'number',
      label: 'Planner Score',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'angleKey',
      type: 'text',
      label: 'Angle',
      admin: {
        description: 'For roundups — the lifestyle angle, e.g. apartments. See lib/content-styles.ts.',
        condition: (data) => data?.style === 'best-for',
      },
    },
    {
      name: 'breedGroup',
      type: 'text',
      label: 'Breed Group',
      admin: {
        description: 'For group roundups — which group to cover.',
        condition: (data) => data?.style === 'group-roundup',
      },
    },
    {
      name: 'breeds',
      type: 'relationship',
      relationTo: 'breeds',
      hasMany: true,
      label: 'Breeds',
      admin: {
        description:
          'Pre-picked for head-to-head and three-way. Roundups leave this empty and shortlist at generation time, so the picks reflect the latest ratings.',
      },
    },
    {
      name: 'criteria',
      type: 'json',
      label: 'Comparison Criteria',
      admin: { description: 'Optional override. Empty means the generator picks.' },
    },
    {
      name: 'reason',
      type: 'textarea',
      label: 'Why This One',
      admin: { description: 'What the planner saw in this idea.' },
    },
    {
      name: 'generatedArticle',
      type: 'relationship',
      relationTo: 'comparisons',
      label: 'Generated Article',
      admin: { description: 'Filled in once the daily job has written it.' },
    },
    {
      name: 'lastError',
      type: 'text',
      label: 'Last Error',
      admin: { readOnly: true, condition: (data) => data?.status === 'failed' },
    },
  ],
}
