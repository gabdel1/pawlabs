'use client'

import React, { useState } from 'react'

interface TraitRatings {
  affectionLevel: number
  childFriendly: number
  petFriendly: number
  strangerFriendly: number
  trainability: number
  energyLevel: number
  groomingNeeds: number
  sheddingLevel: number
  barkingLevel: number
  intelligence: number
  playfulness: number
  watchdogAbility: number
  adaptability: number
  healthRobustness: number
}

interface GeneratedBreed {
  name: string
  slug: string
  petType: 'dog' | 'cat'
  shortDescription: string
  breedGroup: string
  breedRole: string
  size: string
  heightMin: number
  heightMax: number
  weightMin: number
  weightMax: number
  lifeExpectancyMin: number
  lifeExpectancyMax: number
  coatType: string
  coatLength: string
  colors: { color: string }[]
  origin: string
  temperament: { trait: string }[]
  strengths: { point: string }[]
  weaknesses: { point: string }[]
  traits: TraitRatings
  breedHistory: string
  article: string
}

const TRAIT_LABELS: Record<keyof TraitRatings, string> = {
  affectionLevel: 'Affection Level',
  childFriendly: 'Child Friendly',
  petFriendly: 'Pet Friendly',
  strangerFriendly: 'Stranger Friendly',
  trainability: 'Trainability',
  energyLevel: 'Energy Level',
  groomingNeeds: 'Grooming Needs',
  sheddingLevel: 'Shedding Level',
  barkingLevel: 'Barking Level',
  intelligence: 'Intelligence',
  playfulness: 'Playfulness',
  watchdogAbility: 'Watchdog Ability',
  adaptability: 'Adaptability',
  healthRobustness: 'Health Robustness',
}

const navItems = [
  { label: 'Users', href: '/admin/collections/users' },
  { label: 'Media', href: '/admin/collections/media' },
  { label: 'Breeds', href: '/admin/collections/breeds' },
  { label: 'Comparisons', href: '/admin/collections/comparisons' },
]

function TraitBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 10) * 100
  const color = value >= 7 ? '#059669' : value >= 4 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ fontWeight: 500, color: 'var(--theme-text, #333)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}/10</span>
      </div>
      <div style={{ height: 8, background: 'var(--theme-elevation-100, #eee)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export default function AIBreedView() {
  const [breedName, setBreedName] = useState('')
  const [petType, setPetType] = useState<'dog' | 'cat'>('dog')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [breed, setBreed] = useState<GeneratedBreed | null>(null)
  const [saved, setSaved] = useState<{ id: string; slug: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const handleGenerate = async () => {
    if (!breedName.trim()) return
    setLoading(true)
    setError(null)
    setBreed(null)
    setSaved(null)

    try {
      const res = await fetch('/api/ai/breed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          breedName: breedName.trim(),
          petType,
          context: context.trim() || undefined,
          action: 'preview',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setBreed(data.breed)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!breed) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/breed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          breed,
          action: 'save',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(data.saved)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="template-default" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 230,
        minWidth: 230,
        background: 'var(--theme-bg, #fff)',
        borderRight: '1px solid var(--theme-elevation-100, #eee)',
        padding: '16px 0',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <a href="/admin" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 20px 16px',
          textDecoration: 'none',
          color: 'var(--theme-text, #333)',
          fontSize: 13,
          fontWeight: 500,
          opacity: 0.7,
        }}>
          ← Dashboard
        </a>

        <div style={{ padding: '0 12px', marginBottom: 8 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--theme-elevation-400, #999)',
            padding: '6px 8px',
          }}>Collections</div>
        </div>

        <nav style={{ padding: '0 12px' }}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href} style={{
              display: 'block',
              padding: '7px 8px',
              borderRadius: 4,
              textDecoration: 'none',
              color: 'var(--theme-text, #333)',
              fontSize: 13,
              fontWeight: 400,
              transition: 'background 0.1s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-elevation-50, #f5f5f5)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >{item.label}</a>
          ))}
        </nav>

        <div style={{ padding: '8px 12px' }}>
          <a href="/admin/ai-breed" style={{
            display: 'block',
            padding: '7px 8px',
            borderRadius: 4,
            textDecoration: 'none',
            color: 'var(--theme-text, #333)',
            fontSize: 13,
            fontWeight: 600,
            background: 'var(--theme-elevation-50, #f0f0f0)',
          }}>🐾 AI Breed Gen</a>
        </div>

        <div style={{ marginTop: 'auto', padding: '12px 20px' }}>
          <a href="/admin/logout" style={{
            fontSize: 12,
            color: 'var(--theme-elevation-400, #999)',
            textDecoration: 'none',
          }}>↩ Log Out</a>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, background: 'var(--theme-bg, #fff)' }}>
        {/* Top Bar */}
        <div style={{
          borderBottom: '1px solid var(--theme-elevation-100, #eee)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <a href="/admin" style={{ color: 'var(--theme-elevation-400, #999)', textDecoration: 'none', fontSize: 13 }}>Dashboard</a>
          <span style={{ color: 'var(--theme-elevation-300, #ccc)', fontSize: 12 }}>/</span>
          <span style={{ color: 'var(--theme-text, #333)', fontSize: 13, fontWeight: 500 }}>AI Breed Generator</span>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 32px', maxWidth: 1000 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: 'var(--theme-text, #333)' }}>
            AI Breed Profile Generator
          </h1>
          <p style={{ fontSize: 13, color: 'var(--theme-elevation-500, #666)', marginBottom: 24, marginTop: 0 }}>
            Enter a breed name and Grok generates a complete profile with traits, ratings, history, and a detailed article.
          </p>

          {/* Form */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--theme-text, #333)' }}>
                Breed Name <span style={{ color: 'var(--theme-error-500, red)' }}>*</span>
              </label>
              <input
                type="text"
                value={breedName}
                onChange={(e) => setBreedName(e.target.value)}
                placeholder="e.g. Golden Retriever, Maine Coon, German Shepherd"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--theme-elevation-150, #ddd)',
                  borderRadius: 4,
                  background: 'var(--theme-input-bg, #fafafa)',
                  color: 'var(--theme-text, #333)',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ width: 140 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--theme-text, #333)' }}>
                Pet Type
              </label>
              <select
                value={petType}
                onChange={(e) => setPetType(e.target.value as 'dog' | 'cat')}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--theme-elevation-150, #ddd)',
                  borderRadius: 4,
                  background: 'var(--theme-input-bg, #fafafa)',
                  color: 'var(--theme-text, #333)',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              >
                <option value="dog">🐕 Dog</option>
                <option value="cat">🐈 Cat</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--theme-text, #333)' }}>
              Context <span style={{ fontWeight: 400, color: 'var(--theme-elevation-400, #999)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder='e.g. "focus on apartment suitability" or "compare with similar breeds"'
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--theme-elevation-150, #ddd)',
                borderRadius: 4,
                background: 'var(--theme-input-bg, #fafafa)',
                color: 'var(--theme-text, #333)',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !breedName.trim()}
            style={{
              background: loading ? '#94a3b8' : 'var(--theme-text, #222)',
              color: 'var(--theme-bg, #fff)',
              border: 'none',
              borderRadius: 4,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? 'wait' : 'pointer',
              opacity: !breedName.trim() ? 0.5 : 1,
            }}
          >
            {loading ? '⏳ Generating Breed Profile...' : '🐾 Generate Breed Profile'}
          </button>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 4,
              padding: '10px 14px',
              marginTop: 16,
              color: '#b91c1c',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Preview */}
          {breed && (
            <div style={{ marginTop: 24, border: '1px solid var(--theme-elevation-100, #eee)', borderRadius: 6, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{
                background: 'var(--theme-elevation-50, #f8f8f8)',
                padding: '14px 20px',
                borderBottom: '1px solid var(--theme-elevation-100, #eee)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--theme-text, #333)' }}>{breed.name}</span>
                  <span style={{
                    marginLeft: 10,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: breed.petType === 'dog' ? '#dbeafe' : '#fce7f3',
                    color: breed.petType === 'dog' ? '#1e40af' : '#be185d',
                  }}>
                    {breed.petType === 'dog' ? '🐕 Dog' : '🐈 Cat'}
                  </span>
                </div>
                {!saved ? (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      background: saving ? '#94a3b8' : '#059669',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: saving ? 'wait' : 'pointer',
                    }}
                  >{saving ? 'Saving...' : '💾 Save to Breeds'}</button>
                ) : (
                  <a href={`/admin/collections/breeds/${saved.id}`} style={{
                    background: 'var(--theme-text, #222)',
                    color: 'var(--theme-bg, #fff)',
                    borderRadius: 4,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}>Edit →</a>
                )}
              </div>

              {saved && (
                <div style={{ background: '#f0fdf4', padding: '10px 20px', borderBottom: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
                  ✅ Saved to Breeds (ID: {saved.id}) — Add a breed image in the editor.
                </div>
              )}

              <div style={{ padding: 20 }}>
                {/* Overview Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 16px', marginBottom: 20, fontSize: 13 }}>
                  {[
                    ['Group', breed.breedGroup],
                    ['Size', breed.size],
                    ['Height', `${breed.heightMin}"–${breed.heightMax}"`],
                    ['Weight', `${breed.weightMin}–${breed.weightMax} lbs`],
                    ['Life Span', `${breed.lifeExpectancyMin}–${breed.lifeExpectancyMax} yrs`],
                    ['Coat', `${breed.coatType} / ${breed.coatLength}`],
                    ['Origin', breed.origin],
                    ['Slug', breed.slug],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontWeight: 600, color: 'var(--theme-elevation-500, #888)', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                      <div style={{ color: 'var(--theme-text, #333)' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Short Description */}
                <div style={{ fontSize: 14, color: 'var(--theme-text, #333)', marginBottom: 16, fontStyle: 'italic' }}>
                  {breed.shortDescription}
                </div>

                {/* Role */}
                <div style={{ fontSize: 13, color: 'var(--theme-elevation-500, #666)', marginBottom: 16 }}>
                  <strong>Role:</strong> {breed.breedRole}
                </div>

                {/* Temperament Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                  {breed.temperament.map((t, i) => (
                    <span key={i} style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: 'var(--theme-elevation-50, #f0f0f0)',
                      color: 'var(--theme-text, #555)',
                    }}>{t.trait}</span>
                  ))}
                </div>

                {/* Colors */}
                <div style={{ marginBottom: 20, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: 'var(--theme-elevation-500, #888)', fontSize: 11, textTransform: 'uppercase' }}>Colors: </span>
                  {breed.colors.map(c => c.color).join(', ')}
                </div>

                {/* Strengths / Weaknesses */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginBottom: 6 }}>STRENGTHS</div>
                    {breed.strengths.map((s, i) => (
                      <div key={i} style={{ fontSize: 13, marginBottom: 3, color: 'var(--theme-text, #333)' }}>+ {s.point}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>WEAKNESSES</div>
                    {breed.weaknesses.map((w, i) => (
                      <div key={i} style={{ fontSize: 13, marginBottom: 3, color: 'var(--theme-text, #333)' }}>− {w.point}</div>
                    ))}
                  </div>
                </div>

                {/* Trait Ratings Bar Chart */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text, #333)', marginBottom: 12 }}>Trait Ratings</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                    {(Object.keys(TRAIT_LABELS) as (keyof TraitRatings)[]).map((key) => (
                      <TraitBar key={key} label={TRAIT_LABELS[key]} value={breed.traits[key]} />
                    ))}
                  </div>
                </div>

                {/* Breed History */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-elevation-500, #888)', textTransform: 'uppercase', marginBottom: 8 }}>Breed History</div>
                  <div
                    style={{
                      background: 'var(--theme-elevation-50, #f9f9f9)',
                      border: '1px solid var(--theme-elevation-100, #eee)',
                      borderRadius: 4,
                      padding: 16,
                      fontSize: 14,
                      lineHeight: 1.7,
                      maxHeight: 250,
                      overflow: 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: breed.breedHistory }}
                  />
                </div>

                {/* Full Article */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-elevation-500, #888)', textTransform: 'uppercase', marginBottom: 8 }}>Full Article</div>
                  <div
                    style={{
                      background: 'var(--theme-elevation-50, #f9f9f9)',
                      border: '1px solid var(--theme-elevation-100, #eee)',
                      borderRadius: 4,
                      padding: 16,
                      fontSize: 14,
                      lineHeight: 1.7,
                      maxHeight: 500,
                      overflow: 'auto',
                    }}
                    dangerouslySetInnerHTML={{ __html: breed.article }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
