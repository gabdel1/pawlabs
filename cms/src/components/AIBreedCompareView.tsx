'use client'

import React, { useState, useEffect } from 'react'

interface Breed {
  id: string
  name: string
  slug: string
  petType?: string
  breedGroup?: string
  size?: string
  traits?: Record<string, number>
}

interface GeneratedComparison {
  title: string
  slug: string
  summary: string
  content: string
  verdict: string
}

const CRITERIA_OPTIONS = [
  { value: 'lowShedding', label: 'Low Shedding' },
  { value: 'apartmentFriendly', label: 'Apartment Friendly' },
  { value: 'watchdogAbility', label: 'Watchdog Ability' },
  { value: 'trainability', label: 'Trainability' },
  { value: 'childFriendly', label: 'Child Friendly' },
  { value: 'energyLevel', label: 'Energy Level' },
  { value: 'easyGrooming', label: 'Easy Grooming' },
  { value: 'petFriendly', label: 'Pet Friendly' },
  { value: 'barkingControl', label: 'Low Barking' },
  { value: 'adaptability', label: 'Adaptability' },
  { value: 'intelligence', label: 'Intelligence' },
  { value: 'healthRobustness', label: 'Health Robustness' },
]

const DEFAULT_CRITERIA = ['lowShedding', 'apartmentFriendly', 'watchdogAbility', 'trainability', 'childFriendly', 'energyLevel', 'easyGrooming']

const navItems = [
  { label: 'Users', href: '/admin/collections/users' },
  { label: 'Media', href: '/admin/collections/media' },
  { label: 'Breeds', href: '/admin/collections/breeds' },
  { label: 'Comparisons', href: '/admin/collections/comparisons' },
]

function Sidebar() {
  return (
    <aside style={{
      width: 230, minWidth: 230,
      background: 'var(--theme-bg, #fff)',
      borderRight: '1px solid var(--theme-elevation-100, #eee)',
      padding: '16px 0', display: 'flex', flexDirection: 'column',
    }}>
      <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px 16px', textDecoration: 'none', color: 'var(--theme-text, #333)', fontSize: 13, fontWeight: 500, opacity: 0.7 }}>
        ← Dashboard
      </a>
      <div style={{ padding: '0 12px', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--theme-elevation-400, #999)', padding: '6px 8px' }}>Collections</div>
      </div>
      <nav style={{ padding: '0 12px' }}>
        {navItems.map(item => (
          <a key={item.href} href={item.href} style={{ display: 'block', padding: '7px 8px', borderRadius: 4, textDecoration: 'none', color: 'var(--theme-text, #333)', fontSize: 13, fontWeight: 400, transition: 'background 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--theme-elevation-50, #f5f5f5)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >{item.label}</a>
        ))}
      </nav>
      <div style={{ padding: '8px 12px' }}>
        <a href="/admin/ai-generate" style={{ display: 'block', padding: '7px 8px', borderRadius: 4, textDecoration: 'none', color: 'var(--theme-text, #333)', fontSize: 13 }}>🤖 AI Generate</a>
        <a href="/admin/ai-guide" style={{ display: 'block', padding: '7px 8px', borderRadius: 4, textDecoration: 'none', color: 'var(--theme-text, #333)', fontSize: 13 }}>📝 AI Guides</a>
        <a href="/admin/ai-breed" style={{ display: 'block', padding: '7px 8px', borderRadius: 4, textDecoration: 'none', color: 'var(--theme-text, #333)', fontSize: 13 }}>🐾 AI Breeds</a>
        <a href="/admin/ai-breed-compare" style={{ display: 'block', padding: '7px 8px', borderRadius: 4, textDecoration: 'none', color: 'var(--theme-text, #333)', fontSize: 13, fontWeight: 700, background: 'var(--theme-elevation-50, #f0f0f0)' }}>⚖️ Breed Compare</a>
      </div>
      <div style={{ marginTop: 'auto', padding: '12px 20px' }}>
        <a href="/admin/logout" style={{ fontSize: 12, color: 'var(--theme-elevation-400, #999)', textDecoration: 'none' }}>↩ Log Out</a>
      </div>
    </aside>
  )
}

export default function AIBreedCompareView() {
  const [breeds, setBreeds] = useState<Breed[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [criteria, setCriteria] = useState<string[]>(DEFAULT_CRITERIA)
  const [context, setContext] = useState('')
  const [loadingBreeds, setLoadingBreeds] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratedComparison | null>(null)
  const [saved, setSaved] = useState<{ id: string; slug: string } | null>(null)
  const [search, setSearch] = useState('')
  const [petTypeFilter, setPetTypeFilter] = useState('all')

  useEffect(() => {
    fetch('/api/breeds?limit=300&depth=1&where[status][equals]=published', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setBreeds(data.docs || []))
      .catch(() => {})
      .finally(() => setLoadingBreeds(false))
  }, [])

  const toggleBreed = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleCriterion = (value: string) => {
    setCriteria(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value])
  }

  const selectedBreeds = breeds.filter(b => selected.includes(b.id))

  const filteredBreeds = breeds.filter(b => {
    const matchesPet = petTypeFilter === 'all' || b.petType === petTypeFilter
    const matchesSearch = !search || b.name.toLowerCase().includes(search.toLowerCase())
    return matchesPet && matchesSearch
  })

  const handleGenerate = async () => {
    if (selected.length < 2) return
    setGenerating(true)
    setError(null)
    setResult(null)
    setSaved(null)

    try {
      const res = await fetch('/api/ai/breed-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          breedIds: selected,
          criteria,
          context: context.trim() || undefined,
          action: 'preview',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResult(data.guide)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/breed-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          breedIds: selected,
          criteria,
          context: context.trim() || undefined,
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    border: '1px solid var(--theme-elevation-150, #ddd)',
    borderRadius: 4, background: 'var(--theme-input-bg, #fafafa)',
    color: 'var(--theme-text, #333)', fontSize: 13,
    boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div className="template-default" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />

      <main style={{ flex: 1, background: 'var(--theme-bg, #fff)', overflowY: 'auto' }}>
        {/* Top bar */}
        <div style={{ borderBottom: '1px solid var(--theme-elevation-100, #eee)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/admin" style={{ color: 'var(--theme-elevation-400, #999)', textDecoration: 'none', fontSize: 13 }}>Dashboard</a>
          <span style={{ color: 'var(--theme-elevation-300, #ccc)', fontSize: 12 }}>/</span>
          <span style={{ color: 'var(--theme-text, #333)', fontSize: 13, fontWeight: 500 }}>Breed Comparison Generator</span>
        </div>

        <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: 'var(--theme-text, #333)' }}>
            ⚖️ Breed Comparison Review Generator
          </h1>
          <p style={{ fontSize: 13, color: 'var(--theme-elevation-500, #666)', marginBottom: 28, marginTop: 0 }}>
            Select 2 or more breeds, choose comparison criteria, and Grok writes a full breed review with a modern comparison table and verdict.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
            {/* LEFT: Breed Picker */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--theme-text, #333)', marginBottom: 12 }}>
                1. Pick Breeds <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--theme-elevation-400, #999)' }}>(select 2 or more)</span>
              </div>

              {/* Selected pills */}
              {selectedBreeds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
                  {selectedBreeds.map(b => (
                    <button key={b.id} onClick={() => toggleBreed(b.id)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: '#dcfce7', borderRadius: 20, padding: '3px 10px',
                      fontSize: 12, fontWeight: 600, color: '#166534', border: 'none', cursor: 'pointer',
                    }}>
                      {b.name} <span style={{ opacity: 0.5 }}>×</span>
                    </button>
                  ))}
                  <button onClick={() => setSelected([])} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
                    Clear all
                  </button>
                </div>
              )}

              {/* Filters */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 4, background: 'var(--theme-elevation-50, #f5f5f5)', padding: 3, borderRadius: 6 }}>
                  {(['all', 'dog', 'cat'] as const).map(pt => (
                    <button key={pt} onClick={() => setPetTypeFilter(pt)} style={{
                      padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: petTypeFilter === pt ? 'var(--theme-text, #333)' : 'transparent',
                      color: petTypeFilter === pt ? 'var(--theme-bg, #fff)' : 'var(--theme-elevation-500, #666)',
                    }}>
                      {pt === 'all' ? 'All' : pt === 'dog' ? '🐕 Dogs' : '🐈 Cats'}
                    </button>
                  ))}
                </div>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search breeds…"
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>

              {/* Breed list */}
              <div style={{ border: '1px solid var(--theme-elevation-100, #eee)', borderRadius: 6, maxHeight: 420, overflowY: 'auto' }}>
                {loadingBreeds ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-elevation-400, #999)', fontSize: 13 }}>Loading breeds…</div>
                ) : filteredBreeds.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-elevation-400, #999)', fontSize: 13 }}>No breeds found</div>
                ) : (
                  filteredBreeds.map(breed => {
                    const isSelected = selected.includes(breed.id)
                    return (
                      <button
                        key={breed.id}
                        onClick={() => toggleBreed(breed.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                          padding: '9px 14px', border: 'none', textAlign: 'left',
                          borderBottom: '1px solid var(--theme-elevation-50, #f5f5f5)',
                          background: isSelected ? '#f0fdf4' : 'transparent',
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--theme-elevation-50, #f9f9f9)' }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, border: '2px solid',
                          borderColor: isSelected ? '#059669' : 'var(--theme-elevation-200, #ccc)',
                          background: isSelected ? '#059669' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.15s',
                        }}>
                          {isSelected && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--theme-text, #333)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{breed.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--theme-elevation-400, #999)', marginTop: 1 }}>
                            {breed.petType === 'dog' ? '🐕' : '🐈'} {breed.breedGroup || ''} {breed.size ? `· ${breed.size}` : ''}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* RIGHT: Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Criteria selector */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--theme-text, #333)', marginBottom: 4 }}>
                  2. Comparison Criteria
                </div>
                <p style={{ fontSize: 12, color: 'var(--theme-elevation-400, #999)', margin: '0 0 12px' }}>
                  These determine which columns appear in the table. Default selection covers the most-searched traits.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {CRITERIA_OPTIONS.map(opt => {
                    const on = criteria.includes(opt.value)
                    return (
                      <button key={opt.value} onClick={() => toggleCriterion(opt.value)} style={{
                        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${on ? '#059669' : 'var(--theme-elevation-150, #ddd)'}`,
                        background: on ? '#dcfce7' : 'transparent',
                        color: on ? '#166534' : 'var(--theme-elevation-500, #666)',
                        transition: 'all 0.15s',
                      }}>
                        {on ? '✓ ' : ''}{opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Context */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--theme-text, #333)', marginBottom: 4 }}>
                  3. Writing Context <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--theme-elevation-400, #999)' }}>(optional)</span>
                </div>
                <textarea
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder='e.g. "Target: first-time dog owners in an apartment" or "Focus on which breed is better for families with kids"'
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              {/* Summary of selection */}
              <div style={{
                background: selected.length >= 2 ? '#f0fdf4' : 'var(--theme-elevation-50, #f9f9f9)',
                border: `1px solid ${selected.length >= 2 ? '#bbf7d0' : 'var(--theme-elevation-100, #eee)'}`,
                borderRadius: 6, padding: '12px 16px', fontSize: 13,
              }}>
                <div style={{ fontWeight: 600, color: selected.length >= 2 ? '#166534' : 'var(--theme-elevation-500, #666)', marginBottom: 4 }}>
                  {selected.length < 2
                    ? `Select ${2 - selected.length} more breed${2 - selected.length === 1 ? '' : 's'} to continue`
                    : `✓ Ready to generate: ${selected.length} breeds × ${criteria.length} criteria`
                  }
                </div>
                {selected.length >= 2 && criteria.length > 0 && (
                  <div style={{ fontSize: 12, color: '#166534' }}>
                    {selectedBreeds.map(b => b.name).join(' vs ')}
                  </div>
                )}
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={generating || selected.length < 2 || criteria.length === 0}
                style={{
                  background: generating ? '#94a3b8' : (selected.length < 2 ? '#e5e7eb' : 'var(--theme-text, #222)'),
                  color: selected.length < 2 ? '#9ca3af' : 'var(--theme-bg, #fff)',
                  border: 'none', borderRadius: 6, padding: '12px 20px',
                  fontSize: 14, fontWeight: 700,
                  cursor: generating ? 'wait' : (selected.length < 2 ? 'not-allowed' : 'pointer'),
                  transition: 'all 0.2s',
                }}
              >
                {generating
                  ? '⏳ Generating comparison with Grok…'
                  : selected.length < 2
                    ? 'Select at least 2 breeds'
                    : `⚖️ Generate Breed Comparison (${selected.length} breeds)`}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 16px', marginTop: 24, color: '#b91c1c', fontSize: 13 }}>
              ❌ {error}
            </div>
          )}

          {/* Result Preview */}
          {result && (
            <div style={{ marginTop: 32, border: '1px solid var(--theme-elevation-100, #eee)', borderRadius: 8, overflow: 'hidden' }}>
              {/* Preview header */}
              <div style={{
                background: 'var(--theme-elevation-50, #f8f8f8)', padding: '14px 20px',
                borderBottom: '1px solid var(--theme-elevation-100, #eee)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--theme-text, #333)' }}>⚖️ {result.title}</span>
                  <div style={{ fontSize: 12, color: 'var(--theme-elevation-400, #999)', marginTop: 3 }}>/{result.slug}</div>
                </div>
                {!saved ? (
                  <button onClick={handleSave} disabled={saving} style={{
                    background: saving ? '#94a3b8' : '#059669', color: '#fff',
                    border: 'none', borderRadius: 6, padding: '9px 18px',
                    fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
                  }}>
                    {saving ? 'Saving…' : '💾 Save as Breed Comparison'}
                  </button>
                ) : (
                  <a href={`/admin/collections/comparisons/${saved.id}`} style={{
                    background: 'var(--theme-text, #222)', color: 'var(--theme-bg, #fff)',
                    borderRadius: 6, padding: '9px 18px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  }}>
                    ✅ Edit Comparison →
                  </a>
                )}
              </div>

              {saved && (
                <div style={{ background: '#f0fdf4', padding: '10px 20px', borderBottom: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
                  ✅ Saved to Guides as a "Breed Comparison Review" (ID: {saved.id}).
                  Add a featured image and publish when ready. The comparison table and verdict are already wired in.
                </div>
              )}

              <div style={{ padding: '20px 24px' }}>
                {/* Summary */}
                <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#166534', marginBottom: 6 }}>SEO Summary</div>
                  <p style={{ margin: 0, fontSize: 14, color: '#166534', lineHeight: 1.6 }}>{result.summary}</p>
                </div>

                {/* Article body */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--theme-elevation-500, #888)', marginBottom: 10 }}>
                    Article Body
                  </div>
                  <div
                    style={{
                      background: 'var(--theme-elevation-50, #f9f9f9)', border: '1px solid var(--theme-elevation-100, #eee)',
                      borderRadius: 6, padding: '16px 20px', fontSize: 14, lineHeight: 1.75,
                      maxHeight: 320, overflowY: 'auto',
                      color: 'var(--theme-text, #333)',
                    }}
                    dangerouslySetInnerHTML={{ __html: result.content }}
                  />
                </div>

                {/* Verdict */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--theme-elevation-500, #888)', marginBottom: 10 }}>
                    Final Verdict
                  </div>
                  <div
                    style={{
                      background: '#ecfdf5', border: '1px solid #a7f3d0',
                      borderRadius: 6, padding: '16px 20px', fontSize: 14, lineHeight: 1.75,
                      maxHeight: 240, overflowY: 'auto',
                      color: '#065f46',
                    }}
                    dangerouslySetInnerHTML={{ __html: result.verdict }}
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
