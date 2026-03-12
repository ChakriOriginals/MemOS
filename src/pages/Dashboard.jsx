import { useNavigate } from 'react-router-dom'
import useStore from '../store'
import { CAT_META, CATEGORIES, daysUntil, timeAgo, retentionColor } from '../lib/constants'
import { StatCard, CatTag, ConfidenceBadge, ProgressBar, EmptyState } from '../components/UI'

export default function Dashboard() {
  const navigate = useNavigate()
  const { nodes, sources, jobs } = useStore(s => ({ nodes: s.nodes, sources: s.sources, jobs: s.jobs }))

  const dueNodes = nodes.filter(n => daysUntil(n.fsrs_state?.next_review_at) <= 0)
  const soonNodes = nodes.filter(n => { const d = daysUntil(n.fsrs_state?.next_review_at); return d > 0 && d <= 3 })
  const avgRetention = nodes.length
    ? Math.round(nodes.reduce((a, n) => a + Math.min(1, (n.fsrs_state?.stability || 1) / 10), 0) / nodes.length * 100)
    : 0

  const byCat = CATEGORIES.reduce((a, c) => { a[c] = nodes.filter(n => n.category === c).length; return a }, {})
  const recentNodes = [...nodes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6)
  const recentSources = [...sources].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4)

  return (
    <div className="fade-up" style={{ padding: '32px 36px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginTop: 6 }}>
          {dueNodes.length > 0
            ? `You have ${dueNodes.length} node${dueNodes.length > 1 ? 's' : ''} due for review. Your memory needs attention.`
            : nodes.length === 0
            ? 'Welcome to MemOS. Start by ingesting your first document.'
            : 'Keep building your knowledge graph.'}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard label="Memory Nodes" value={nodes.length} sub="total extracted" icon="◈" color="var(--accent)" bg="var(--accent-light)" />
        <StatCard label="Due for Review" value={dueNodes.length} sub="need attention now" icon="◎" color="#EF4444" bg="#FFF1F2" />
        <StatCard label="Due in 3 Days" value={soonNodes.length} sub="upcoming reviews" icon="◷" color="#F97316" bg="#FFF7ED" />
        <StatCard label="Est. Retention" value={`${avgRetention}%`} sub="avg across all nodes" icon="⬆" color="#22C55E" bg="#F0FDF4" />
      </div>

      {/* Review CTA */}
      {dueNodes.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)',
          border: '1px solid #BFDBFE',
          borderRadius: 16,
          padding: '20px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}>🧠 Review session ready</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
              {dueNodes.length} cards overdue · estimated {Math.ceil(dueNodes.length * 0.75)} min · FSRS-4.5 scheduling
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/review')}>
            Start Review →
          </button>
        </div>
      )}

      {/* HyperResearch CTA */}
      <div style={{
        background: 'linear-gradient(135deg, var(--purple-light) 0%, var(--accent-light) 100%)',
        border: '1px solid #C4B5FD',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}>⬡ HyperResearch is ready</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Ask anything across all your {sources.length} source{sources.length !== 1 ? 's' : ''} — AI synthesizes answers with full citations
          </div>
        </div>
        <button className="btn" style={{ background: 'var(--purple)', color: '#fff' }} onClick={() => navigate('/research')}>
          Open HyperResearch →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        {/* Recent Nodes */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent Nodes</h3>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => navigate('/library')}>
              View all →
            </button>
          </div>
          {recentNodes.length === 0 ? (
            <EmptyState icon="◈" title="No nodes yet" description="Ingest a document to extract memory nodes" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentNodes.map(n => (
                <NodeRow key={n.id} node={n} />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Category breakdown */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Knowledge Map</h3>
            {nodes.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No nodes yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {CATEGORIES.filter(c => byCat[c] > 0).map(c => (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CatTag category={c} />
                    <ProgressBar value={byCat[c]} max={nodes.length} color={CAT_META[c].text} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 20, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {byCat[c]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next reviews */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Upcoming Reviews</h3>
            {nodes.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>No reviews scheduled</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...nodes]
                  .sort((a, b) => new Date(a.fsrs_state?.next_review_at) - new Date(b.fsrs_state?.next_review_at))
                  .slice(0, 5)
                  .map(n => {
                    const d = daysUntil(n.fsrs_state?.next_review_at)
                    return (
                      <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.concept.slice(0, 55)}…
                        </span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: retentionColor(d), flexShrink: 0 }}>
                          {d <= 0 ? 'NOW' : d === 1 ? '1d' : `${d}d`}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Sources */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Sources</h3>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => navigate('/library')}>
                View →
              </button>
            </div>
            {recentSources.map(s => (
              <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, padding: '6px 0' }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.node_count || 0} nodes · {timeAgo(s.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function NodeRow({ node }) {
  const d = daysUntil(node.fsrs_state?.next_review_at)
  return (
    <div className="card-hover" style={{
      padding: '11px 13px',
      background: 'var(--bg-secondary)',
      borderRadius: 10,
      border: '1px solid var(--border-light)',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>
            {node.concept.slice(0, 105)}{node.concept.length > 105 ? '…' : ''}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {node.source_ref?.title} · {timeAgo(node.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <CatTag category={node.category} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: retentionColor(d), fontWeight: 600 }}>
            {d <= 0 ? 'DUE' : `+${d}d`}
          </span>
        </div>
      </div>
    </div>
  )
}
