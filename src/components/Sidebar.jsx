import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useStore from '../store'

const NAV_ITEMS = [
  { path: '/',          icon: '◈', label: 'Dashboard',       badge: null },
  { path: '/ingest',    icon: '⊕', label: 'Ingest',          badge: null },
  { path: '/library',   icon: '◻', label: 'Library',         badge: null },
  { path: '/research',  icon: '⬡', label: 'HyperResearch',   badge: null, highlight: true },
  { path: '/review',    icon: '◎', label: 'Recall',          badge: 'due' },
  { path: '/graph',     icon: '✦', label: 'Knowledge Graph', badge: null },
  { path: '/analytics', icon: '▦', label: 'Analytics',       badge: null },
  { path: '/settings',  icon: '⚙', label: 'Settings',        badge: null },
]

export default function Sidebar({ onApiKeyClick }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { nodes, apiKey } = useStore(s => ({ nodes: s.nodes, apiKey: s.apiKey }))
  const dueCount = nodes.filter(n => {
    const d = (new Date(n.fsrs_state?.next_review_at) - Date.now()) / 86400000
    return d <= 0
  }).length

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      background: 'var(--bg-primary)',
      borderRight: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 38, height: 38,
            background: 'linear-gradient(135deg, #4A90E2 0%, #7C3AED 100%)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#fff',
            boxShadow: '0 4px 12px rgba(74,144,226,0.3)',
          }}>⬡</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 450, fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>MemOS</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: -2 }}>MEMORY OS v1.0</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ path, icon, label, badge, highlight }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
          const badgeCount = badge === 'due' ? dueCount : null

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '10px 13px',
                borderRadius: 10,
                marginBottom: 2,
                color: active ? '#1D4ED8' : highlight ? 'var(--purple)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400,
                fontSize: 14,
                textAlign: 'left',
                background: active ? 'var(--accent-light)' : highlight && !active ? 'var(--purple-light)' : 'transparent',
                borderRight: active ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-secondary)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = highlight && !active ? 'var(--purple-light)' : 'transparent' }}
            >
              <span style={{ fontSize: 15, minWidth: 18, textAlign: 'center' }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badgeCount > 0 && (
                <span style={{
                  background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 10, lineHeight: 1.4,
                }}>{badgeCount}</span>
              )}
              {highlight && !active && (
                <span style={{ fontSize: 9, background: 'var(--purple)', color: '#fff', padding: '2px 5px', borderRadius: 4, fontWeight: 600 }}>AI</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* API Status + Profile */}
      <div style={{ padding: '12px 10px 20px', borderTop: '1px solid var(--border-light)' }}>
        <button
          onClick={onApiKeyClick}
          style={{
            width: '100%',
            padding: '10px 13px',
            borderRadius: 10,
            border: `1.5px dashed ${apiKey ? '#86EFAC' : 'var(--border)'}`,
            background: apiKey ? '#F0FDF4' : 'var(--bg-secondary)',
            color: apiKey ? '#15803D' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 8, width: 8, height: 8, borderRadius: '50%', background: apiKey ? '#22C55E' : '#94A3B8', display: 'inline-block', boxShadow: apiKey ? '0 0 6px #22C55E' : 'none' }} />
          {apiKey ? 'AI Engine Active' : 'Connect API Key'}
        </button>
      </div>
    </aside>
  )
}
