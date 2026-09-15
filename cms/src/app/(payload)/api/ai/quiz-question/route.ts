import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import {
  generateQuizQuestionsWithGrok,
  type GeneratedQuizQuestion,
} from '../../../../../lib/grok-quiz-questions'

/**
 * Admin-only endpoint behind /admin/ai-quiz.
 *
 *  - action "notes"    → recent free-text notes left by quiz takers, so the
 *                        questions we add next come from what people actually
 *                        told us the quiz failed to ask.
 *  - action "preview"  → draft questions from notes (nothing saved).
 *  - action "save"     → store reviewed drafts in the Quiz Questions collection.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }

    const body = (await req.json()) as Record<string, any>
    const action = body?.action ?? 'preview'

    // ── Recent visitor notes ─────────────────────────────────────────
    if (action === 'notes') {
      const submissions = await payload.find({
        collection: 'quiz-submissions',
        where: { note: { exists: true } } as any,
        limit: 60,
        depth: 0,
        sort: '-createdAt',
      })
      const notes = (submissions.docs as Record<string, any>[])
        .map((d) => ({
          note: String(d.note ?? '').trim(),
          petType: d.petType as string | undefined,
          createdAt: d.createdAt as string,
        }))
        .filter((n) => n.note.length > 0)

      return NextResponse.json({ success: true, notes }, { headers: CORS_HEADERS })
    }

    // ── Save reviewed drafts ─────────────────────────────────────────
    if (action === 'save') {
      const questions = (Array.isArray(body.questions) ? body.questions : []) as GeneratedQuizQuestion[]
      if (questions.length === 0) {
        return NextResponse.json(
          { error: 'No questions to save' },
          { status: 400, headers: CORS_HEADERS },
        )
      }

      const existing = await payload.find({
        collection: 'quiz-questions',
        limit: 200,
        depth: 0,
      })
      const takenKeys = new Set(
        (existing.docs as Record<string, any>[]).map((d) => String(d.key)),
      )
      const maxOrder = (existing.docs as Record<string, any>[]).reduce(
        (max, d) => Math.max(max, Number(d.order) || 0),
        0,
      )

      const saved: { id: string | number; key: string; question: string }[] = []
      let order = maxOrder

      for (const q of questions) {
        let key = String(q.key || '').trim()
        if (!key) continue
        let suffix = 2
        const base = key
        while (takenKeys.has(key)) key = `${base}-${suffix++}`
        takenKeys.add(key)

        order += 10

        const doc = await payload.create({
          collection: 'quiz-questions',
          data: {
            question: q.question,
            helper: q.helper,
            key,
            order,
            status: 'draft',
            petScope: q.petScope ?? 'both',
            type: q.type ?? 'single',
            layout: q.layout ?? 'grid',
            emoji: q.emoji,
            required: true,
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
            sourceNote: typeof body.notes === 'string' ? body.notes.slice(0, 4000) : undefined,
            aiGenerated: true,
          } as any,
        })

        saved.push({ id: doc.id, key, question: q.question })
      }

      if (saved.length === 0) {
        return NextResponse.json(
          { error: 'Nothing could be saved — every question was missing a key.' },
          { status: 400, headers: CORS_HEADERS },
        )
      }

      return NextResponse.json({ success: true, saved }, { headers: CORS_HEADERS })
    }

    // ── Draft from notes ─────────────────────────────────────────────
    const notes = typeof body.notes === 'string' ? body.notes : ''
    if (!notes.trim()) {
      return NextResponse.json(
        { error: 'Add some notes to draft questions from' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const existing = await payload.find({
      collection: 'quiz-questions',
      limit: 200,
      depth: 0,
      sort: 'order',
    })

    const generated = await generateQuizQuestionsWithGrok(notes, {
      count: Number(body.count) || 3,
      petScope: ['both', 'dog', 'cat'].includes(body.petScope) ? body.petScope : 'both',
      existingQuestions: (existing.docs as Record<string, any>[]).map((d) => ({
        key: String(d.key),
        question: String(d.question),
      })),
    })

    return NextResponse.json({ success: true, questions: generated }, { headers: CORS_HEADERS })
  } catch (error: any) {
    console.error('AI Quiz Question error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to draft quiz questions' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
