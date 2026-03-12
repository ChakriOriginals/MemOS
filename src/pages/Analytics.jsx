import useStore from '../store'
import { CAT_META, CATEGORIES, daysUntil, timeAgo, retentionColor } from '../lib/constants'
import { ProgressBar, CatTag } from '../components/UI'

export default function AnalyticsPage() {
  const { nodes, sources, chunks } = useStore(s => ({ nodes: s.nodes, sources: s.sources, chunks: s.chunks || [] }))

  const dueNodes = nodes.filter(n => daysUntil(n.fsrs_state?.next_review_at) <= 0)
  const reviewedNodes = nodes.filter(n => n.fsrs_state?.review_count > 0)
  const avgStability = nodes.length
    ? (nodes.reduce((a, n) => a + (n.fsrs_state?.stability || 1), 0) / nodes.length).toFixed(1)
    : 0
  const avgConfidence = nodes.length
    ? Math.round(nodes.reduce((a, n) => a + n.confidence, 0) / nodes.length * 100)
    : 0

  const byCat = CATEGORIES.reduce((a, c) => { a[c] = nodes.filter(n => n.category === c).length; return a }, {})
  const bySource = sources.map(s => ({
    ...s,
    nodeCount: nodes.filter(n => n.source_id === s.id).length,
    chunkCount: chunks.filter(c => c.source_id === s.id).length,
  }))

  // Retention buckets
  const buckets = {
    'Due now': nodes.filter(n => daysUntil(n.fsrs_state?.next_review_at) <= 0).length,
    '1-3 days': nodes.filter(n => { const d = daysUntil(n.fsrs_state?.next_review_at); return d >= 1 && d <= 3 }).length,
    '4-7 days': nodes.filter(n => { const d = daysUntil(n.fsrs_state?.next_review_at); return d >= 4 && d <= 7 }).length,
    '1-4 weeks': nodes.filter(n => { const d = daysUntil(n.fsrs_state?.next_review_at); return d >= 8 && d <= 28 }).length,
    '1+ month': nodes.filter(n => daysUntil(n.fsrs_state?.next_review_at) > 28).length,
  }

  return (
    <div className="fade-up" style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)' }}>Analytics</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Memory health, knowledge coverage, and learning velocity</p>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Nodes', value: nodes.length, color: 'var(--accent)' },
          { label: 'Sources', value: sources.length, color: '#8B5CF6' },
          { label: 'Chunks Indexed', value: chunks.length, color: '#10B981' },
          { label: 'Avg Stability', value: avgStability, color: '#F59E0B' },
          { label: 'Avg Confidence', value: `${avgConfidence}%`, color: '#EF4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '18px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'var(--font-display)' }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Category distribution */}
        <div className="card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Node Type Distribution</h3>
          {nodes.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CATEGORIES.map(c => {
                const count = byCat[c]
                if (count === 0) return null
                const pct = Math.round(count / nodes.length * 100)
                return (
                  <div key={c}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <CatTag category={c} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {count} ({pct}%)
                      </span>
                    </div>
                    <ProgressBar value={count} max={nodes.length} color={CAT_META[c].text} height={5} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Retention schedule */}
        <div className="card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Retention Schedule</h3>
          {nodes.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No data yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(buckets).map(([label, count]) => {
                const colors = {
                  'Due now': '#EF4444',
                  '1-3 days': '#F97316',
                  '4-7 days': '#EAB308',
                  '1-4 weeks': '#10B981',
                  '1+ month': '#3B82F6',
                }
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                        {count} nodes
                      </span>
                    </div>
                    <ProgressBar value={count} max={Math.max(nodes.length, 1)} color={colors[label]} height={5} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sources breakdown */}
      <div className="card" style={{ padding: '22px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Sources Overview</h3>
        {bySource.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No sources ingested yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Source', 'Author', 'Type', 'Nodes', 'Chunks', 'Status', 'Added'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', borderBottom: '1px solid var(--border-light)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bySource.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)', maxWidth: 200 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {s.title}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{s.author || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ textTransform: 'capitalize', fontSize: 11, padding: '2px 8px', background: 'var(--bg-secondary)', borderRadius: 20, color: 'var(--text-secondary)' }}>
                        {s.type || 'doc'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-dark)', fontWeight: 600 }}>{s.nodeCount}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{s.chunkCount}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                        background: s.status === 'complete' ? '#D1FAE5' : s.status === 'failed' ? '#FEE2E2' : '#FEF3C7',
                        color: s.status === 'complete' ? '#065F46' : s.status === 'failed' ? '#991B1B' : '#92400E',
                      }}>
                        {s.status || 'ready'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{timeAgo(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decay heatmap preview */}
      <div className="card" style={{ padding: '22px', marginTop: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Node Decay Heatmap</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {nodes.slice(0, 60).map(n => {
            const d = daysUntil(n.fsrs_state?.next_review_at)
            return (
              <div
                key={n.id}
                title={n.concept.slice(0, 60)}
                style={{
                  width: 14, height: 14,
                  borderRadius: 3,
                  background: retentionColor(d),
                  opacity: 0.85,
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.4)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              />
            )
          })}
          {nodes.length > 60 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>
              +{nodes.length - 60} more
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>🔴 Due now</span>
          <span>🟠 1-2 days</span>
          <span>🟡 3-7 days</span>
          <span>🟢 7+ days</span>
        </div>
      </div>
    </div>
  )
}
