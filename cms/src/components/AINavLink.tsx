'use client'

import React from 'react'

const linkStyle: React.CSSProperties = {
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
}

const links = [
  { href: '/admin/ai-breed', label: '🐾 AI Breeds' },
  { href: '/admin/ai-breed-compare', label: '⚖️ Breed Compare' },
]

export default function AINavLink() {
  return (
    <>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          style={linkStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--theme-elevation-100)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {link.label}
        </a>
      ))}
    </>
  )
}
