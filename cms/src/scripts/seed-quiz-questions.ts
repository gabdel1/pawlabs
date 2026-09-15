/**
 * Seeds the baseline Breed Match quiz.
 *
 *   cd /srv/pet/cms && npx tsx src/scripts/seed-quiz-questions.ts
 *
 * Idempotent: a question whose `key` already exists is skipped, never
 * overwritten, so hand-tuned weights survive a re-run. Pass --force to update
 * existing questions in place instead.
 *
 * Pet type is not a question here — the quiz asks it up front, because the
 * answer decides which of these questions get asked at all.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Without this the postgres adapter treats the run as development and pushes
// the schema on boot. Schema changes belong in migrations, not in a seed run.
process.env.NODE_ENV ||= 'production'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(dirname, '../../.env')

// Plain `tsx` does not load .env the way the Payload CLI does.
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.trim().replace(/^["'](.*)["']$/, '$1')
  }
}

type Weight = { trait: string; target: number; weight: number }
type Option = {
  label: string
  value: string
  emoji?: string
  description?: string
  weights?: Weight[]
  prefersSizes?: string[]
}
type Question = {
  question: string
  helper?: string
  key: string
  order: number
  emoji?: string
  type?: 'single' | 'multi' | 'text'
  layout?: 'grid' | 'list' | 'scale'
  petScope?: 'both' | 'dog' | 'cat'
  required?: boolean
  maxSelections?: number
  placeholder?: string
  options?: Option[]
}

const w = (trait: string, target: number, weight: number): Weight => ({ trait, target, weight })

const QUESTIONS: Question[] = [
  {
    key: 'home-setup',
    order: 10,
    emoji: '🏠',
    question: 'Where will they actually live?',
    helper: 'Space shapes more of this decision than almost anything else.',
    layout: 'grid',
    options: [
      {
        label: 'An apartment',
        value: 'apartment',
        emoji: '🏢',
        description: 'No outdoor space of my own',
        weights: [w('adaptability', 9, 4), w('barkingLevel', 3, 4), w('energyLevel', 4, 3)],
        prefersSizes: ['small', 'medium'],
      },
      {
        label: 'A house, small yard',
        value: 'small-yard',
        emoji: '🏡',
        description: 'Enough for a sniff, not a sprint',
        weights: [w('adaptability', 7, 2), w('energyLevel', 6, 2)],
        prefersSizes: ['small', 'medium', 'large'],
      },
      {
        label: 'A house, big yard',
        value: 'big-yard',
        emoji: '🌳',
        description: 'Room to actually run',
        weights: [w('energyLevel', 8, 3)],
        prefersSizes: ['medium', 'large', 'giant'],
      },
      {
        label: 'Rural, land around us',
        value: 'rural',
        emoji: '🚜',
        description: 'Acreage, or close to it',
        weights: [w('energyLevel', 9, 3), w('adaptability', 5, 1)],
        prefersSizes: ['medium', 'large', 'giant'],
      },
    ],
  },
  {
    key: 'activity-level',
    order: 20,
    emoji: '🏃',
    question: 'Be honest about a normal week.',
    helper: 'Not your best week. A normal one, in February, when it rains.',
    layout: 'list',
    petScope: 'dog',
    options: [
      {
        label: "I'm out running, hiking or cycling most days",
        value: 'athlete',
        emoji: '⛰️',
        weights: [w('energyLevel', 9, 5), w('playfulness', 8, 2)],
      },
      {
        label: 'A proper walk every day, rain or shine',
        value: 'daily-walk',
        emoji: '🚶',
        weights: [w('energyLevel', 7, 4)],
      },
      {
        label: 'Around the block, most days',
        value: 'light',
        emoji: '🌤️',
        weights: [w('energyLevel', 4, 4)],
      },
      {
        label: "Realistically, I'd rather they entertain themselves",
        value: 'low',
        emoji: '🛋️',
        weights: [w('energyLevel', 2, 5), w('adaptability', 8, 2)],
      },
    ],
  },
  {
    key: 'play-time',
    order: 20,
    emoji: '🪶',
    question: 'How much active play are you actually up for?',
    helper: 'Some cats want a twenty-minute hunt twice a day. Some want a warm lap.',
    layout: 'list',
    petScope: 'cat',
    options: [
      {
        label: 'Daily wand sessions — I want a busy, clever cat',
        value: 'high',
        emoji: '🎣',
        weights: [w('energyLevel', 9, 4), w('playfulness', 9, 4), w('intelligence', 8, 2)],
      },
      {
        label: 'A good play most evenings',
        value: 'medium',
        emoji: '🧶',
        weights: [w('energyLevel', 6, 3), w('playfulness', 7, 2)],
      },
      {
        label: 'Occasional — mostly I want company',
        value: 'low',
        emoji: '🛏️',
        weights: [w('energyLevel', 3, 4), w('affectionLevel', 8, 3)],
      },
    ],
  },
  {
    key: 'hours-alone',
    order: 30,
    emoji: '⏰',
    question: 'How long is your home empty on a normal weekday?',
    helper: 'This is the question people wish they had answered honestly.',
    layout: 'scale',
    options: [
      {
        label: 'Barely ever',
        value: 'wfh',
        emoji: '🏠',
        description: "I'm home most of the day",
        weights: [w('affectionLevel', 9, 3)],
      },
      {
        label: '3–5 hours',
        value: 'short',
        emoji: '🕒',
        weights: [w('affectionLevel', 7, 2), w('adaptability', 6, 2)],
      },
      {
        label: '6–8 hours',
        value: 'workday',
        emoji: '🕕',
        weights: [w('adaptability', 8, 4), w('affectionLevel', 5, 2), w('energyLevel', 4, 2)],
      },
      {
        label: '9 hours or more',
        value: 'long',
        emoji: '🌙',
        weights: [w('adaptability', 9, 5), w('affectionLevel', 4, 3), w('energyLevel', 3, 3)],
      },
    ],
  },
  {
    key: 'household',
    order: 40,
    emoji: '👨‍👩‍👧',
    question: 'Who else is at home?',
    helper: 'Pick everything that applies.',
    type: 'multi',
    layout: 'grid',
    maxSelections: 5,
    options: [
      {
        label: 'Young children',
        value: 'young-kids',
        emoji: '🧒',
        description: 'Under 8',
        weights: [w('childFriendly', 9, 5), w('playfulness', 7, 2)],
      },
      {
        label: 'Older kids or teens',
        value: 'older-kids',
        emoji: '🧑',
        weights: [w('childFriendly', 8, 3)],
      },
      {
        label: 'Another dog',
        value: 'dog',
        emoji: '🐕',
        weights: [w('petFriendly', 9, 4)],
      },
      {
        label: 'A cat',
        value: 'cat',
        emoji: '🐈',
        weights: [w('petFriendly', 9, 4)],
      },
      {
        label: 'Just adults',
        value: 'adults',
        emoji: '🧑‍🤝‍🧑',
        description: 'No kids, no other pets',
        weights: [],
      },
    ],
  },
  {
    key: 'experience',
    order: 50,
    emoji: '🎓',
    question: 'How much of this have you done before?',
    layout: 'list',
    options: [
      {
        label: 'This would be my first',
        value: 'first-timer',
        emoji: '🌱',
        weights: [
          w('trainability', 9, 4),
          w('healthRobustness', 8, 3),
          w('adaptability', 8, 2),
        ],
      },
      {
        label: 'We had one growing up',
        value: 'childhood',
        emoji: '📷',
        weights: [w('trainability', 7, 3)],
      },
      {
        label: "I've raised and trained my own",
        value: 'experienced',
        emoji: '🎾',
        weights: [w('trainability', 5, 1)],
      },
      {
        label: 'I actively want a challenge',
        value: 'challenge',
        emoji: '🧗',
        description: 'A stubborn, clever, hard-headed one',
        weights: [w('trainability', 4, 2), w('intelligence', 9, 3)],
      },
    ],
  },
  {
    key: 'grooming-tolerance',
    order: 60,
    emoji: '🧹',
    question: 'How do you feel about hair, brushing, and the vacuum?',
    layout: 'list',
    options: [
      {
        label: 'Hair on everything is a dealbreaker',
        value: 'no-shedding',
        emoji: '🚫',
        description: 'Allergies, dark suits, or both',
        weights: [w('sheddingLevel', 2, 5), w('groomingNeeds', 4, 2)],
      },
      {
        label: "A weekly brush is fine — I'd rather not vacuum daily",
        value: 'low-maintenance',
        emoji: '🪮',
        weights: [w('sheddingLevel', 4, 3), w('groomingNeeds', 5, 2)],
      },
      {
        label: "I genuinely don't mind the upkeep",
        value: 'relaxed',
        emoji: '🤷',
        weights: [w('sheddingLevel', 7, 1)],
      },
      {
        label: "I'd happily book a groomer every month",
        value: 'groomer',
        emoji: '✂️',
        description: 'A coat that needs work is fine by me',
        weights: [w('groomingNeeds', 8, 2)],
      },
    ],
  },
  {
    key: 'noise-tolerance',
    order: 70,
    emoji: '🔊',
    question: 'How much noise can your walls take?',
    helper: 'Barking, yowling, the 6am announcement that a leaf moved.',
    layout: 'scale',
    options: [
      {
        label: 'Near silence',
        value: 'silent',
        emoji: '🤫',
        description: 'Thin walls, a newborn, or night shifts',
        weights: [w('barkingLevel', 2, 5)],
      },
      {
        label: 'The odd alert is fine',
        value: 'some',
        emoji: '🔉',
        weights: [w('barkingLevel', 4, 3)],
      },
      {
        label: "Doesn't bother me",
        value: 'tolerant',
        emoji: '🔊',
        weights: [w('barkingLevel', 6, 1)],
      },
      {
        label: 'I want to hear about it',
        value: 'wants-alert',
        emoji: '📢',
        description: 'Tell me when someone is at the door',
        weights: [w('barkingLevel', 8, 2), w('watchdogAbility', 9, 3)],
      },
    ],
  },
  {
    key: 'the-job',
    order: 80,
    emoji: '💚',
    question: "What's the job you're hiring for?",
    helper: 'Pick up to two.',
    type: 'multi',
    layout: 'grid',
    maxSelections: 2,
    options: [
      {
        label: 'A shadow',
        value: 'companion',
        emoji: '🫂',
        description: 'Follows me room to room',
        weights: [w('affectionLevel', 10, 4)],
      },
      {
        label: 'A training partner',
        value: 'training',
        emoji: '🎯',
        description: 'Tricks, sports, real work',
        weights: [w('trainability', 9, 4), w('intelligence', 9, 3)],
      },
      {
        label: 'An adventure buddy',
        value: 'adventure',
        emoji: '🥾',
        description: 'Trails, water, long days out',
        weights: [w('energyLevel', 9, 4), w('healthRobustness', 7, 2)],
      },
      {
        label: 'A watchful eye',
        value: 'guard',
        emoji: '🛡️',
        description: 'Someone who notices things',
        weights: [w('watchdogAbility', 9, 4), w('strangerFriendly', 4, 2)],
      },
      {
        label: 'A calm presence',
        value: 'calm',
        emoji: '🕊️',
        description: 'Steady in a busy house',
        weights: [w('adaptability', 9, 3), w('energyLevel', 3, 3), w('childFriendly', 8, 2)],
      },
      {
        label: 'A playmate for the kids',
        value: 'playmate',
        emoji: '🎈',
        weights: [w('playfulness', 9, 3), w('childFriendly', 9, 4)],
      },
    ],
  },
  {
    key: 'visitors',
    order: 90,
    emoji: '🚪',
    question: 'How often do new people come through your door?',
    layout: 'grid',
    options: [
      {
        label: 'Constantly',
        value: 'often',
        emoji: '🎉',
        description: 'Friends, family, deliveries, chaos',
        weights: [w('strangerFriendly', 9, 4), w('barkingLevel', 3, 2)],
      },
      {
        label: 'Now and then',
        value: 'sometimes',
        emoji: '🙋',
        weights: [w('strangerFriendly', 6, 2)],
      },
      {
        label: "Rarely — it's a quiet house",
        value: 'rarely',
        emoji: '🔕',
        weights: [w('strangerFriendly', 4, 1), w('watchdogAbility', 7, 1)],
      },
    ],
  },
  {
    key: 'vet-budget',
    order: 100,
    emoji: '💸',
    question: 'Vet bills — what is your honest tolerance?',
    helper: 'Some breeds carry known, expensive conditions. Better to know now.',
    layout: 'list',
    options: [
      {
        label: "I need the healthiest, lowest-risk breed you've got",
        value: 'low-risk',
        emoji: '🛟',
        weights: [w('healthRobustness', 9, 5)],
      },
      {
        label: "I've budgeted for the usual, not for chronic conditions",
        value: 'moderate',
        emoji: '📊',
        weights: [w('healthRobustness', 7, 3)],
      },
      {
        label: "I'm insured and prepared for whatever comes",
        value: 'prepared',
        emoji: '🩺',
        weights: [w('healthRobustness', 5, 1)],
      },
    ],
  },
  {
    key: 'anything-else',
    order: 110,
    emoji: '✍️',
    question: 'Anything we should know that we forgot to ask?',
    helper: 'Allergies, a breed you already love, a deal-breaker. Optional — but it changes the answer.',
    type: 'text',
    required: false,
    placeholder: "e.g. I'm allergic to dander, or my last dog was a Beagle and I want something calmer",
  },
]

async function main() {
  const force = process.argv.includes('--force')
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config.js')).default
  const payload = await getPayload({ config })

  let created = 0
  let updated = 0
  let skipped = 0

  for (const q of QUESTIONS) {
    const existing = await payload.find({
      collection: 'quiz-questions',
      where: { key: { equals: q.key } },
      limit: 1,
      depth: 0,
    })

    const data = {
      question: q.question,
      helper: q.helper,
      key: q.key,
      order: q.order,
      status: 'published',
      petScope: q.petScope ?? 'both',
      type: q.type ?? 'single',
      layout: q.layout ?? 'grid',
      emoji: q.emoji,
      required: q.required ?? true,
      maxSelections: q.maxSelections,
      placeholder: q.placeholder,
      options: (q.options ?? []).map((o) => ({
        label: o.label,
        value: o.value,
        emoji: o.emoji,
        description: o.description,
        weights: o.weights ?? [],
        prefersSizes: o.prefersSizes ?? [],
      })),
      aiGenerated: false,
    }

    if (existing.docs.length > 0) {
      if (!force) {
        skipped += 1
        continue
      }
      await payload.update({
        collection: 'quiz-questions',
        id: existing.docs[0].id,
        data: data as never,
      })
      updated += 1
      continue
    }

    await payload.create({ collection: 'quiz-questions', data: data as never })
    created += 1
  }

  console.log(
    `Quiz questions — created: ${created}, updated: ${updated}, skipped (already present): ${skipped}`,
  )
  if (skipped > 0 && !force) {
    console.log('Re-run with --force to overwrite existing questions.')
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
