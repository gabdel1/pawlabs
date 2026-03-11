'use client'

import React from 'react'

export default function AINavLink() {
  return (
    <a
      href="/admin/ai-generate"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--theme-text)',
        textDecoration: 'none',
        borderRadius: 4,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-elevation-100)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      🤖 AI Generate
    </a>
  )
}
