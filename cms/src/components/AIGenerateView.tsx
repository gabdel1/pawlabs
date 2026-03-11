'use client'

import React, { useState } from 'react'

interface GeneratedProduct {
  name: string
  slug: string
  shortDescription: string
  price: number
  affiliateUrl: string
  category: string
  subcategory: string
  animalTypes: string[]
  rating: number
  featured: boolean
  pros: { point: string }[]
  cons: { point: string }[]
  reviewBody: string
}

const navItems = [
  { label: 'Users', href: '/admin/collections/users' },
  { label: 'Media', href: '/admin/collections/media' },
  { label: 'Products', href: '/admin/collections/products' },
  { label: 'Reviews', href: '/admin/collections/reviews' },
]

export default function AIGenerateView() {
  const [url, setUrl] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [product, setProduct] = useState<GeneratedProduct | null>(null)
  const [saved, setSaved] = useState<{ id: string; slug: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const handleGenerate = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setProduct(null)
    setSaved(null)

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim(), context: context.trim() || undefined, action: 'preview' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setProduct(data.product)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!product) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim(), context: context.trim() || undefined, action: 'save' }),
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
        {/* Logo / Back */}
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
          <a href="/admin/ai-generate" style={{
            display: 'block',
            padding: '7px 8px',
            borderRadius: 4,
            textDecoration: 'none',
            color: 'var(--theme-text, #333)',
            fontSize: 13,
            fontWeight: 600,
            background: 'var(--theme-elevation-50, #f0f0f0)',
          }}>🤖 AI Generate</a>
        </div>

        {/* Logout */}
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
          <span style={{ color: 'var(--theme-text, #333)', fontSize: 13, fontWeight: 500 }}>AI Generate</span>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 32px', maxWidth: 900 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: 'var(--theme-text, #333)' }}>
            AI Product Generator
          </h1>
          <p style={{ fontSize: 13, color: 'var(--theme-elevation-500, #666)', marginBottom: 24, marginTop: 0 }}>
            Paste an affiliate link and Grok generates a complete product with pricing, categories, pros/cons, and a human-written review.
          </p>

          {/* Form */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--theme-text, #333)' }}>
              Product URL <span style={{ color: 'var(--theme-error-500, red)' }}>*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://amazon.com/dp/B0BFH9XKGL?tag=pawlabs-20"
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

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--theme-text, #333)' }}>
              Context <span style={{ fontWeight: 400, color: 'var(--theme-elevation-400, #999)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder='e.g. "self-cleaning cat litter box, WiFi, $699"'
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
            disabled={loading || !url.trim()}
            className="btn"
            style={{
              background: loading ? '#94a3b8' : 'var(--theme-text, #222)',
              color: 'var(--theme-bg, #fff)',
              border: 'none',
              borderRadius: 4,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? 'wait' : 'pointer',
              opacity: !url.trim() ? 0.5 : 1,
            }}
          >
            {loading ? '⏳ Generating with Grok...' : '🚀 Generate Review'}
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
          {product && (
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
                <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--theme-text, #333)' }}>{product.name}</span>
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
                  >{saving ? 'Saving...' : '💾 Save to Products'}</button>
                ) : (
                  <a href={`/admin/collections/products/${saved.id}`} style={{
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
                  ✅ Saved to Products (ID: {saved.id})
                </div>
              )}

              <div style={{ padding: 20 }}>
                {/* Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 16px', marginBottom: 20, fontSize: 13 }}>
                  {[
                    ['Price', `$${product.price}`],
                    ['Rating', `${product.rating}/5`],
                    ['Category', `${product.category} › ${product.subcategory}`],
                    ['Animals', product.animalTypes.join(', ')],
                    ['Featured', product.featured ? 'Yes' : 'No'],
                    ['Slug', product.slug],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontWeight: 600, color: 'var(--theme-elevation-500, #888)', fontSize: 11, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                      <div style={{ color: 'var(--theme-text, #333)' }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 14, color: 'var(--theme-text, #333)', marginBottom: 16, fontStyle: 'italic' }}>
                  {product.shortDescription}
                </div>

                {/* Pros/Cons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginBottom: 6 }}>PROS</div>
                    {product.pros.map((p, i) => (
                      <div key={i} style={{ fontSize: 13, marginBottom: 3, color: 'var(--theme-text, #333)' }}>+ {p.point}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>CONS</div>
                    {product.cons.map((c, i) => (
                      <div key={i} style={{ fontSize: 13, marginBottom: 3, color: 'var(--theme-text, #333)' }}>− {c.point}</div>
                    ))}
                  </div>
                </div>

                {/* Review */}
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-elevation-500, #888)', textTransform: 'uppercase', marginBottom: 8 }}>Review Body</div>
                <div
                  style={{
                    background: 'var(--theme-elevation-50, #f9f9f9)',
                    border: '1px solid var(--theme-elevation-100, #eee)',
                    borderRadius: 4,
                    padding: 16,
                    fontSize: 14,
                    lineHeight: 1.7,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                  dangerouslySetInnerHTML={{ __html: product.reviewBody }}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
