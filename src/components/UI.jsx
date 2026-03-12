import { CAT_META } from '../lib/constants'
import useStore from '../store'

// ── Toast notification ───────────────────────────────────────────────────────
export function Toast() {
  const notification = useStore(s => s.notification)
  if (!notification) return null

  const colors = {
    success: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7', icon: '✓' },
    error:   { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5', icon: '✕' },
    info:    { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD', icon: 'ℹ' },
    warning: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A', icon: '⚠' },
  }
  const c = colors[notification.type] || colors.success

  return (
    <div className="toast" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <span style={{ fontSize: 16 }}>{c.icon}</span>
      {notification.msg}
    </div>
  )
}

// ── Category tag ─────────────────────────────────────────────────────────────
export function CatTag({ category, size = 'sm' }) {
  const m = CAT_META[category] || CAT_META.fact
  const pad = size === 'sm' ? '3px 9px' : '5px 12px'
  const fs = size === 'sm' ? 11 : 13
  return (
    <span className="tag" style={{ background: m.bg, color: m.text, borderColor: m.border, padding: pad, fontSize: fs }}>
      {m.icon} {m.label}
    </span>
  )
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 18, color = 'var(--accent)' }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size,
      border: `2px solid ${color}22`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

// ── Thinking indicator ───────────────────────────────────────────────────────
export function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </span>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'var(--font-display)' }}>{title}</div>
      {description && <div style={{ fontSize: 14, maxWidth: 360, margin: '0 auto 20px' }}>{description}</div>}
      {action}
    </div>
  )
}

// ── Progress bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'var(--accent)', height = 6 }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ height, background: 'var(--bg-tertiary)', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: height, transition: 'width 0.4s ease' }} />
    </div>
  )
}

// ── Shimmer skeleton ─────────────────────────────────────────────────────────
export function Skeleton({ height = 20, width = '100%', style = {} }) {
  return <div className="shimmer" style={{ height, width, borderRadius: 6, ...style }} />
}

// ── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, children, width = 520 }) {
  if (!open) return null
  return (
    <div className="fade-in" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} className="card fade-up" style={{
        width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto',
        padding: 32, boxShadow: 'var(--shadow-lg)',
      }}>
        {children}
      </div>
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon, color, bg }) {
  return (
    <div className="card card-hover" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-1px' }}>{value}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
        </div>
        <div style={{ width: 42, height: 42, background: bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// ── Confidence badge ─────────────────────────────────────────────────────────
export function ConfidenceBadge({ value }) {
  const pct = Math.round(value * 100)
  const color = pct >= 90 ? '#22C55E' : pct >= 70 ? '#EAB308' : '#F97316'
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, background: color + '18', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>
      {pct}%
    </span>
  )
}

// ── Section header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
