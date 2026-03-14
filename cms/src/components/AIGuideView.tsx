'use client'

import React, { useState, useEffect } from 'react'

interface Product {
  id: string
  name: string
  slug: string
  category?: string
  petType?: string
  price?: number
  rating?: number
  shortDescription?: string
}

interface GeneratedGuide {
  title: string
  slug: string
  guideType: string
  summary: string
  content: string
  category: string
  petType: string
}

const CATEGORY_LABELS: Record<string, string> = {
  'smart-gadgets': 'Smart Gadgets',
  'toys': 'Toys',
  'food-treats': 'Food & Treats',
  'health-wellness': 'Health & Wellness',
  'grooming': 'Grooming',
  'beds-furniture': 'Beds & Furniture',
  'leashes-collars': 'Leashes & Collars',
  'travel': 'Travel',
  'other': 'Other',
}

const GUIDE_TYPE_LABELS: Record<string, string> = {
  'ultimate-guide': '📘 Ultimate Guide',
  'essentials': '🎒 Essentials Roundup',
  'roundup': '📋 Product Roundup',
  'comparison': '⚖️ Comparison Guide',
}

const navItems = [
  { label: 'Users', href: '/admin/collections/users' },
  { label: 'Media', href: '/admin/collections/media' },
  { label: 'Products', href: '/admin/collections/products' },
  { label: 'Reviews', href: '/admin/collections/reviews' },
  { label: 'Guides', href: '/admin/collections/guides' },
]

export default function AIGuideView() {
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guide, setGuide] = useState<GeneratedGuide | null>(null)
  const [saved, setSaved] = useState<{ id: string; slug: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products?limit=200&depth=0', { credentials: 'include' })
        const data = await res.json()
        setProducts(data.docs || [])
      } catch (err) {
        console.error('Failed to fetch products:', err)
      } finally {
        setLoadingProducts(false)
      }
    }
    fetchProducts()
  }, [])

  const toggleProduct = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Get unique categories from products
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleGenerate = async () => {
    if (selected.length < 2) return
    setLoading(true)
    setError(null)
    setGuide(null)
    setSaved(null)

    try {
      const res = await fetch('/api/ai/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productIds: selected,
          context: context.trim() || undefined,
          action: 'preview',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setGuide(data.guide)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!guide) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productIds: selected,
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

  const selectedProducts = products.filter(p => selected.includes(p.id))

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
        }}>← Dashboard</a>

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
            fontWeight: 400,
          }}>🤖 AI Generate</a>
          <a href="/admin/ai-guide" style={{
            display: 'block',
            padding: '7px 8px',
            borderRadius: 4,
            textDecoration: 'none',
            color: 'var(--theme-text, #333)',
            fontSize: 13,
            fontWeight: 600,
            background: 'var(--theme-elevation-50, #f0f0f0)',
          }}>📝 AI Guides</a>
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
          <span style={{ color: 'var(--theme-text, #333)', fontSize: 13, fontWeight: 500 }}>AI Guide Generator</span>
        </div>

        <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: 'var(--theme-text, #333)' }}>
            AI Guide Generator
          </h1>
          <p style={{ fontSize: 13, color: 'var(--theme-elevation-500, #666)', marginBottom: 24, marginTop: 0 }}>
            Select products to generate a comprehensive guide article with Grok. Links are automatically pulled from your product database.
          </p>

          {/* Selected products summary */}
          {selected.length > 0 && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
                  {selected.length} product{selected.length !== 1 ? 's' : ''} selected
                </span>
                {selectedProducts.map(p => (
                  <span key={p.id} style={{
                    background: '#dcfce7',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    color: '#166534',
                  }}>
                    {p.name.length > 30 ? p.name.substring(0, 27) + '…' : p.name}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setSelected([])}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >Clear All</button>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--theme-elevation-150, #ddd)',
                borderRadius: 4,
                background: 'var(--theme-input-bg, #fafafa)',
                color: 'var(--theme-text, #333)',
                fontSize: 13,
              }}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
              ))}
            </select>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              style={{
                flex: 1,
                minWidth: 200,
                padding: '8px 12px',
                border: '1px solid var(--theme-elevation-150, #ddd)',
                borderRadius: 4,
                background: 'var(--theme-input-bg, #fafafa)',
                color: 'var(--theme-text, #333)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* Product Cards Grid */}
          {loadingProducts ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--theme-elevation-400, #999)', fontSize: 13 }}>
              Loading products...
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
              marginBottom: 24,
              maxHeight: 400,
              overflow: 'auto',
              padding: 4,
            }}>
              {filteredProducts.map(p => {
                const isSelected = selected.includes(p.id)
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleProduct(p.id)}
                    style={{
                      border: isSelected
                        ? '2px solid #059669'
                        : '1px solid var(--theme-elevation-150, #ddd)',
                      borderRadius: 6,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      background: isSelected ? '#f0fdf4' : 'var(--theme-bg, #fff)',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                  >
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                      }}>✓</div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text, #333)', marginBottom: 4, paddingRight: isSelected ? 24 : 0 }}>
                      {p.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {p.category && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          background: 'var(--theme-elevation-50, #f5f5f5)',
                          padding: '2px 6px',
                          borderRadius: 3,
                          color: 'var(--theme-elevation-500, #888)',
                        }}>{CATEGORY_LABELS[p.category] || p.category}</span>
                      )}
                      {p.price != null && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-text, #333)' }}>
                          ${p.price.toFixed(2)}
                        </span>
                      )}
                      {p.rating != null && (
                        <span style={{ fontSize: 11, color: 'var(--theme-elevation-400, #999)' }}>
                          ★ {p.rating}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Context */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--theme-text, #333)' }}>
              Context <span style={{ fontWeight: 400, color: 'var(--theme-elevation-400, #999)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder='e.g. "Focus on budget-friendly options for first-time cat owners"'
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

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || selected.length < 2}
            className="btn"
            style={{
              background: loading ? '#94a3b8' : 'var(--theme-text, #222)',
              color: 'var(--theme-bg, #fff)',
              border: 'none',
              borderRadius: 4,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? 'wait' : (selected.length < 2 ? 'not-allowed' : 'pointer'),
              opacity: selected.length < 2 ? 0.5 : 1,
            }}
          >
            {loading
              ? '⏳ Generating guide with Grok...'
              : selected.length < 2
                ? 'Select at least 2 products'
                : `📝 Generate Guide (${selected.length} products)`}
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
          {guide && (
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
                  <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--theme-text, #333)' }}>{guide.title}</span>
                  <span style={{
                    marginLeft: 10,
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#dbeafe',
                    color: '#1e40af',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}>{GUIDE_TYPE_LABELS[guide.guideType] || guide.guideType}</span>
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
                  >{saving ? 'Saving...' : '💾 Save as Guide'}</button>
                ) : (
                  <a href={`/admin/collections/guides/${saved.id}`} style={{
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
                  ✅ Saved to Guides (ID: {saved.id})
                </div>
              )}

              {/* Meta */}
              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--theme-elevation-100, #eee)',
                display: 'flex',
                gap: 16,
                fontSize: 12,
                flexWrap: 'wrap',
              }}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--theme-elevation-500, #888)' }}>SLUG </span>
                  <span style={{ color: 'var(--theme-text, #333)' }}>{guide.slug}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--theme-elevation-500, #888)' }}>CATEGORY </span>
                  <span style={{ color: 'var(--theme-text, #333)' }}>{CATEGORY_LABELS[guide.category] || guide.category}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--theme-elevation-500, #888)' }}>PET TYPE </span>
                  <span style={{ color: 'var(--theme-text, #333)' }}>{guide.petType}</span>
                </div>
              </div>

              {/* Summary */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--theme-elevation-100, #eee)', fontStyle: 'italic', fontSize: 14, color: 'var(--theme-text, #333)' }}>
                {guide.summary}
              </div>

              {/* Content Preview */}
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-elevation-500, #888)', textTransform: 'uppercase', marginBottom: 8 }}>Guide Content</div>
                <div
                  style={{
                    background: 'var(--theme-elevation-50, #f9f9f9)',
                    border: '1px solid var(--theme-elevation-100, #eee)',
                    borderRadius: 4,
                    padding: 20,
                    fontSize: 14,
                    lineHeight: 1.7,
                    maxHeight: 600,
                    overflow: 'auto',
                  }}
                  dangerouslySetInnerHTML={{ __html: guide.content }}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
