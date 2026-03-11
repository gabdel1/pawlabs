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
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          🤖 AI Product Generator
        </h1>
        <p style={{ color: '#666', fontSize: 14, margin: 0 }}>
          Paste an affiliate link and Grok will generate a complete product review with pricing,
          pros/cons, categories, and a detailed human-written review.
        </p>
      </div>

      {/* Input Form */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
      }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
          Product Affiliate Link *
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://amazon.com/dp/B0BFH9XKGL?tag=pawlabs-20"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 15,
            boxSizing: 'border-box',
            marginBottom: 16,
          }}
        />

        <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
          Additional Context <span style={{ color: '#999', fontWeight: 400 }}>(optional — helps Grok write better)</span>
        </label>
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder='e.g. "self-cleaning cat litter box, WiFi connected, $699"'
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 15,
            boxSizing: 'border-box',
            marginBottom: 20,
          }}
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !url.trim()}
          style={{
            background: loading ? '#94a3b8' : '#1A535C',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 28px',
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {loading ? '⏳ Generating with Grok...' : '🚀 Generate Review'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          color: '#b91c1c',
          fontSize: 14,
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Preview */}
      {product && (
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          <div style={{
            background: '#f0fdfa',
            borderBottom: '1px solid #e2e8f0',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              ✅ Preview: {product.name}
            </h2>
            {!saved ? (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: saving ? '#94a3b8' : '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: saving ? 'wait' : 'pointer',
                }}
              >
                {saving ? '💾 Saving...' : '💾 Save to CMS'}
              </button>
            ) : (
              <a
                href={`/admin/collections/products/${saved.id}`}
                style={{
                  background: '#1A535C',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                ✏️ Edit Product →
              </a>
            )}
          </div>

          <div style={{ padding: 24 }}>
            {/* Meta grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}>
              {[
                { label: 'Price', value: `$${product.price}` },
                { label: 'Rating', value: `${product.rating}/5 ⭐` },
                { label: 'Category', value: `${product.category} › ${product.subcategory}` },
                { label: 'Animals', value: product.animalTypes.join(', ') },
                { label: 'Featured', value: product.featured ? 'Yes' : 'No' },
                { label: 'Slug', value: product.slug },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: '#f8fafc',
                  borderRadius: 8,
                  padding: '10px 14px',
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#475569' }}>Short Description</h3>
              <p style={{ margin: 0, fontSize: 15, color: '#334155', lineHeight: 1.5 }}>{product.shortDescription}</p>
            </div>

            {/* Pros & Cons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#059669' }}>✓ Pros ({product.pros.length})</h3>
                {product.pros.map((p, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#334155', marginBottom: 4, paddingLeft: 12 }}>
                    + {p.point}
                  </div>
                ))}
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#dc2626' }}>✗ Cons ({product.cons.length})</h3>
                {product.cons.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#334155', marginBottom: 4, paddingLeft: 12 }}>
                    − {c.point}
                  </div>
                ))}
              </div>
            </div>

            {/* Review body */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#475569' }}>Review Body</h3>
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: 8,
                  padding: 20,
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: '#334155',
                  maxHeight: 500,
                  overflow: 'auto',
                }}
                dangerouslySetInnerHTML={{ __html: product.reviewBody }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: 8,
          padding: 16,
          color: '#166534',
          fontSize: 14,
        }}>
          ✅ <strong>Product saved!</strong> ID: {saved.id} | Slug: {saved.slug} —{' '}
          <a href={`/admin/collections/products/${saved.id}`} style={{ color: '#059669', fontWeight: 600 }}>
            Edit Product →
          </a>
        </div>
      )}
    </div>
  )
}
