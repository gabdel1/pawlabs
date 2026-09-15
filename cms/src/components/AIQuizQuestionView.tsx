'use client'

import React, { useState } from 'react'

/**
 * /admin/ai-quiz — draft Breed Match quiz questions from notes.
 *
 * Notes come from wherever: a hallway conversation, a support email, or the
 * "anything else we should know?" box at the end of the quiz. Load those
 * visitor notes with one click, generate, review, save as drafts.
 */

interface Weight {
  trait: string
  target: number
  weight: number
}

interface GeneratedOption {
  label: string
  value: string
  emoji?: string
  description?: string
  weights: Weight[]
  prefersSizes?: string[]
}

interface GeneratedQuestion {
  question: string
  helper?: string
  key: string
  emoji?: string
  type: 'single' | 'multi' | 'text'
  layout: 'grid' | 'list' | 'scale'
  petScope: 'both' | 'dog' | 'cat'
  placeholder?: string
  maxSelections?: number
  options: GeneratedOption[]
}

interface VisitorNote {
  note: string
  petType?: string
  createdAt: string
}

const TRAIT_LABELS: Record<string, string> = {
  affectionLevel: 'Affection',
  childFriendly: 'Child friendly',
  petFriendly: 'Pet friendly',
  strangerFriendly: 'Stranger friendly',
  trainability: 'Trainability',
  energyLevel: 'Energy',
  groomingNeeds: 'Grooming',
  sheddingLevel: 'Shedding',
  barkingLevel: 'Barking',
  intelligence: 'Intelligence',
  playfulness: 'Playfulness',
  watchdogAbility: 'Watchdog',
  adaptability: 'Adaptability',
  healthRobustness: 'Health',
}

const navItems = [
  { label: 'Users', href: '/admin/collections/users' },
  { label: 'Media', href: '/admin/collections/media' },
  { label: 'Breeds', href: '/admin/collections/breeds' },
  { label: 'Comparisons', href: '/admin/collections/comparisons' },
  { label: 'Quiz Questions', href: '/admin/collections/quiz-questions' },
  { label: 'Quiz Submissions', href: '/admin/collections/quiz-submissions' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--theme-elevation-150, #ddd)',
  borderRadius: 4,
  background: 'var(--theme-input-bg, #fafafa)',
  color: 'var(--theme-text, #333)',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
  color: 'var(--theme-text, #333)',
}

function WeightChip({ weight }: { weight: Weight }) {
  const strong = weight.weight >= 4
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 7px',
        borderRadius: 10,
        background: strong ? 'rgba(220,38,38,0.09)' : 'var(--theme-elevation-100, #f0f0f0)',
        color: strong ? '#b91c1c' : 'var(--theme-elevation-600, #555)',
      }}
    >
      {TRAIT_LABELS[weight.trait] ?? weight.trait} → {weight.target}/10
      <span style={{ opacity: 0.6 }}>×{weight.weight}</span>
    </span>
  )
}

export default function AIQuizQuestionView() {
  const [notes, setNotes] = useState('')
  const [count, setCount] = useState(3)
  const [petScope, setPetScope] = useState<'both' | 'dog' | 'cat'>('both')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<GeneratedQuestion[] | null>(null)
  const [saved, setSaved] = useState<{ id: string | number; key: string; question: string }[] | null>(null)
  const [visitorNotes, setVisitorNotes] = useState<VisitorNote[] | null>(null)
  const [loadingNotes, setLoadingNotes] = useState(false)

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/ai/quiz-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  const handleLoadNotes = async () => {
    setLoadingNotes(true)
    setError(null)
    try {
      const data = await post({ action: 'notes' })
      setVisitorNotes(data.notes ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingNotes(false)
    }
  }

  const appendNote = (note: string) => {
    setNotes((prev) => (prev.trim() ? `${prev.trim()}\n- ${note}` : `- ${note}`))
  }

  const handleGenerate = async () => {
    if (!notes.trim()) return
    setLoading(true)
    setError(null)
    setQuestions(null)
    setSaved(null)
    try {
      const data = await post({ action: 'preview', notes, count, petScope })
      setQuestions(data.questions ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!questions || questions.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const data = await post({ action: 'save', questions, notes })
      setSaved(data.saved ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateQuestion = (index: number, patch: Partial<GeneratedQuestion>) => {
    setQuestions((prev) =>
      prev ? prev.map((q, i) => (i === index ? { ...q, ...patch } : q)) : prev,
    )
  }

  const removeQuestion = (index: number) => {
    setQuestions((prev) => (prev ? prev.filter((_, i) => i !== index) : prev))
  }

  return (
    <div className="template-default" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 230,
          minWidth: 230,
          background: 'var(--theme-bg, #fff)',
          borderRight: '1px solid var(--theme-elevation-100, #eee)',
          padding: '16px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <a
          href="/admin"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px 16px',
            textDecoration: 'none',
            color: 'var(--theme-text, #333)',
            fontSize: 13,
            fontWeight: 500,
            opacity: 0.7,
          }}
        >
          ← Dashboard
        </a>

        <div style={{ padding: '0 12px', marginBottom: 8 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--theme-elevation-400, #999)',
              padding: '6px 8px',
            }}
          >
            Collections
          </div>
        </div>

        <nav style={{ padding: '0 12px' }}>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: '7px 8px',
                borderRadius: 4,
                textDecoration: 'none',
                color: 'var(--theme-text, #333)',
                fontSize: 13,
                fontWeight: 400,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-elevation-50, #f5f5f5)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div style={{ padding: '8px 12px' }}>
          <a
            href="/admin/ai-quiz"
            style={{
              display: 'block',
              padding: '7px 8px',
              borderRadius: 4,
              textDecoration: 'none',
              color: 'var(--theme-text, #333)',
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--theme-elevation-50, #f0f0f0)',
            }}
          >
            🧩 AI Quiz Questions
          </a>
        </div>

        <div style={{ marginTop: 'auto', padding: '12px 20px' }}>
          <a
            href="/admin/logout"
            style={{ fontSize: 12, color: 'var(--theme-elevation-400, #999)', textDecoration: 'none' }}
          >
            ↩ Log Out
          </a>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, background: 'var(--theme-bg, #fff)' }}>
        <div
          style={{
            borderBottom: '1px solid var(--theme-elevation-100, #eee)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <a href="/admin" style={{ color: 'var(--theme-elevation-400, #999)', textDecoration: 'none', fontSize: 13 }}>
            Dashboard
          </a>
          <span style={{ color: 'var(--theme-elevation-300, #ccc)', fontSize: 12 }}>/</span>
          <span style={{ color: 'var(--theme-text, #333)', fontSize: 13, fontWeight: 500 }}>AI Quiz Questions</span>
        </div>

        <div style={{ padding: '24px 32px', maxWidth: 1000 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: 'var(--theme-text, #333)' }}>
            Quiz Question Generator
          </h1>
          <p style={{ fontSize: 13, color: 'var(--theme-elevation-500, #666)', marginBottom: 24, marginTop: 0 }}>
            Paste notes — your own, or what quiz takers told us we forgot to ask — and Grok drafts questions with the
            trait weights that steer the match. Everything saves as a draft for review.
          </p>

          {/* Visitor notes */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Notes from quiz takers</label>
              <button
                onClick={handleLoadNotes}
                disabled={loadingNotes}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 4,
                  border: '1px solid var(--theme-elevation-150, #ddd)',
                  background: 'transparent',
                  color: 'var(--theme-text, #333)',
                  cursor: loadingNotes ? 'wait' : 'pointer',
                }}
              >
                {loadingNotes ? 'Loading…' : visitorNotes ? 'Refresh' : 'Load recent notes'}
              </button>
            </div>
            {visitorNotes && (
              <div
                style={{
                  border: '1px solid var(--theme-elevation-100, #eee)',
                  borderRadius: 4,
                  maxHeight: 190,
                  overflowY: 'auto',
                  background: 'var(--theme-elevation-25, #fbfbfb)',
                }}
              >
                {visitorNotes.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--theme-elevation-400, #999)', padding: '12px 14px', margin: 0 }}>
                    No notes yet — they arrive as people finish the quiz.
                  </p>
                ) : (
                  visitorNotes.map((n, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        padding: '9px 12px',
                        borderBottom:
                          i === visitorNotes.length - 1 ? 'none' : '1px solid var(--theme-elevation-100, #eee)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, margin: 0, color: 'var(--theme-text, #333)' }}>{n.note}</p>
                        <span style={{ fontSize: 11, color: 'var(--theme-elevation-400, #999)' }}>
                          {n.petType ?? 'either'} · {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        onClick={() => appendNote(n.note)}
                        style={{
                          padding: '3px 9px',
                          fontSize: 11,
                          fontWeight: 500,
                          borderRadius: 4,
                          border: '1px solid var(--theme-elevation-150, #ddd)',
                          background: 'transparent',
                          color: 'var(--theme-text, #333)',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        Use
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Notes input */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Notes <span style={{ color: 'var(--theme-error-500, red)' }}>*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              disabled={loading}
              placeholder={
                'e.g.\n- We never ask about allergies, and it comes up constantly\n- Several people said the quiz ignored whether they rent or own\n- Ask about noise tolerance — thin walls, neighbours, newborns'
              }
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 160 }}>
              <label style={labelStyle}>How many</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={loading}
                style={inputStyle}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} question{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 180 }}>
              <label style={labelStyle}>Ask for</label>
              <select
                value={petScope}
                onChange={(e) => setPetScope(e.target.value as 'both' | 'dog' | 'cat')}
                disabled={loading}
                style={inputStyle}
              >
                <option value="both">🐾 Dogs &amp; Cats</option>
                <option value="dog">🐕 Dogs only</option>
                <option value="cat">🐈 Cats only</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={handleGenerate}
                disabled={loading || !notes.trim()}
                style={{
                  padding: '10px 22px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: 'none',
                  background: loading || !notes.trim() ? 'var(--theme-elevation-200, #ccc)' : '#207A5B',
                  color: '#fff',
                  cursor: loading || !notes.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Drafting…' : '✨ Draft Questions'}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 4,
                background: 'rgba(220,38,38,0.08)',
                color: '#b91c1c',
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              {error}
            </div>
          )}

          {saved && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 4,
                background: 'rgba(5,150,105,0.08)',
                color: '#047857',
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              <strong>Saved {saved.length} draft question{saved.length === 1 ? '' : 's'}.</strong> Review the trait
              weights, then set each to Published to put it in the quiz.
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {saved.map((s) => (
                  <li key={String(s.id)} style={{ marginBottom: 3 }}>
                    <a
                      href={`/admin/collections/quiz-questions/${s.id}`}
                      style={{ color: '#047857', fontWeight: 500 }}
                    >
                      {s.question}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview */}
          {questions && questions.length > 0 && !saved && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                }}
              >
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--theme-text, #333)' }}>
                  {questions.length} draft{questions.length === 1 ? '' : 's'}
                </h2>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: 'none',
                    background: saving ? 'var(--theme-elevation-200, #ccc)' : '#0A0F1A',
                    color: '#fff',
                    cursor: saving ? 'wait' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : `Save ${questions.length} as draft${questions.length === 1 ? '' : 's'}`}
                </button>
              </div>

              {questions.map((q, i) => (
                <div
                  key={q.key}
                  style={{
                    border: '1px solid var(--theme-elevation-100, #eee)',
                    borderRadius: 6,
                    padding: 16,
                    marginBottom: 14,
                    background: 'var(--theme-elevation-25, #fbfbfb)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 22, lineHeight: 1.2 }}>{q.emoji || '❓'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        value={q.question}
                        onChange={(e) => updateQuestion(i, { question: e.target.value })}
                        style={{
                          ...inputStyle,
                          fontSize: 15,
                          fontWeight: 600,
                          padding: '6px 8px',
                          background: 'transparent',
                          border: '1px solid transparent',
                        }}
                        onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--theme-elevation-150, #ddd)')}
                        onBlur={(e) => (e.currentTarget.style.border = '1px solid transparent')}
                      />
                      <input
                        value={q.helper ?? ''}
                        onChange={(e) => updateQuestion(i, { helper: e.target.value })}
                        placeholder="Helper text…"
                        style={{
                          ...inputStyle,
                          fontSize: 12.5,
                          padding: '4px 8px',
                          background: 'transparent',
                          border: '1px solid transparent',
                          color: 'var(--theme-elevation-500, #666)',
                        }}
                        onFocus={(e) => (e.currentTarget.style.border = '1px solid var(--theme-elevation-150, #ddd)')}
                        onBlur={(e) => (e.currentTarget.style.border = '1px solid transparent')}
                      />
                    </div>
                    <button
                      onClick={() => removeQuestion(i)}
                      title="Drop this question"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--theme-elevation-400, #999)',
                        cursor: 'pointer',
                        fontSize: 16,
                        padding: '2px 6px',
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0 12px 32px' }}>
                    {[q.key, q.type, q.layout, q.petScope].map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          padding: '2px 7px',
                          borderRadius: 3,
                          background: 'var(--theme-elevation-100, #f0f0f0)',
                          color: 'var(--theme-elevation-600, #555)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div style={{ marginLeft: 32 }}>
                    {q.type === 'text' ? (
                      <p style={{ fontSize: 13, color: 'var(--theme-elevation-500, #666)', margin: 0 }}>
                        Free-text answer — no weights, but it is passed to the matcher as context.
                      </p>
                    ) : (
                      q.options.map((o) => (
                        <div
                          key={o.value}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 4,
                            background: 'var(--theme-bg, #fff)',
                            border: '1px solid var(--theme-elevation-100, #eee)',
                            marginBottom: 6,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                            <span>{o.emoji || '•'}</span>
                            <strong style={{ fontSize: 13, color: 'var(--theme-text, #333)' }}>{o.label}</strong>
                            {o.description && (
                              <span style={{ fontSize: 12, color: 'var(--theme-elevation-400, #999)' }}>
                                — {o.description}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {o.weights.length === 0 ? (
                              <span style={{ fontSize: 11, color: 'var(--theme-elevation-400, #999)' }}>
                                No weights — this answer will not affect the match.
                              </span>
                            ) : (
                              o.weights.map((w, wi) => <WeightChip key={wi} weight={w} />)
                            )}
                            {(o.prefersSizes ?? []).map((s) => (
                              <span
                                key={s}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  padding: '2px 7px',
                                  borderRadius: 10,
                                  background: 'rgba(38,153,111,0.1)',
                                  color: '#207A5B',
                                }}
                              >
                                favours {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
