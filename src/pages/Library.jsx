import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import useStore from '../store'
import { hyperResearchAnswer } from '../lib/hyperrag'
import { timeAgo, CAT_META, daysUntil } from '../lib/constants'
import { CatTag, ConfidenceBadge, EmptyState, ThinkingDots, Spinner, Modal } from '../components/UI'
import { useNavigate } from 'react-router-dom'

export default function LibraryPage() {
  const navigate = useNavigate()
  const { sources, nodes, chunks, removeSource } = useStore(s => ({
    sources: s.sources,
    nodes: s.nodes,
    chunks: s.chunks || [],
    removeSource: s.removeSource,
  }))

  const [selected, setSelected] = useState(null)
  const [searchQ, setSearchQ] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const filtered = sources.filter(s =>
    !searchQ || s.title.toLowerCase().includes(searchQ.toLowerCase()) || s.author?.toLowerCase().includes(searchQ.toLowerCase())
  )

  const selectedSource = sources.find(s => s.id === selected)
  const sourceNodes = selected ? nodes.filter(n => n.source_id === selected) : []
  const sourceChunks = selected ? chunks.filter(c => c.source_id === selected) : []

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Source list */}
      <div style={{
        width: 300,
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 10 }}>Library</div>
          <input
            className="input"
            style={{ fontSize: 13 }}
            placeholder="Search sources…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {filtered.length === 0 && (
            <EmptyState icon="📚" title="No sources" description="Ingest documents to see them here" action={
              <button className="btn btn-primary" onClick={() => navigate('/ingest')} style={{ margin: '0 auto' }}>
                + Ingest First Document
              </button>
            } />
          )}
          {filtered.map(src => {
            const nodeCount = nodes.filter(n => n.source_id === src.id).length
            return (
              <div
                key={src.id}
                onClick={() => setSelected(src.id)}
                style={{
                  padding: '12px 13px',
                  borderRadius: 10,
                  marginBottom: 4,
                  cursor: 'pointer',
                  background: selected === src.id ? 'var(--accent-light)' : 'transparent',
                  border: `1px solid ${selected === src.id ? 'var(--accent)' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (selected !== src.id) e.currentTarget.style.background = 'var(--bg-secondary)' }}
                onMouseLeave={e => { if (selected !== src.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                      {src.title}
                    </div>
                    {src.author && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{src.author}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {nodeCount} nodes
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>·</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(src.created_at)}</span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                    background: src.status === 'complete' ? '#D1FAE5' : src.status === 'failed' ? '#FEE2E2' : '#FEF3C7',
                    color: src.status === 'complete' ? '#065F46' : src.status === 'failed' ? '#991B1B' : '#92400E',
                  }}>
                    {src.status || 'ready'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Source detail */}
      {!selected ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState icon="📚" title="Select a source" description="Choose a document from the library to view its nodes, chat with it, or explore insights" />
        </div>
      ) : (
        <SourceDetail
          source={selectedSource}
          nodes={sourceNodes}
          chunks={sourceChunks}
          onDelete={() => setConfirmDelete(selected)}
        />
      )}

      {/* Delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} width={420}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Delete source?</h3>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
          This will permanently remove this source, all its chunks, and {nodes.filter(n => n.source_id === confirmDelete).length} associated memory nodes.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => {
            removeSource(confirmDelete)
            setSelected(null)
            setConfirmDelete(null)
          }}>
            Delete permanently
          </button>
          <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
        </div>
      </Modal>
    </div>
  )
}

function SourceDetail({ source, nodes, chunks, onDelete }) {
  const [tab, setTab] = useState('chat')
  const { apiKey, notify } = useStore(s => ({
    apiKey: s.apiKey,
    notify: s.notify,
  }))
  const allChunks = useStore(s => s.chunks || [])
  const allSources = useStore(s => s.sources)

  // Per-source chat stored in local state (not persisted — use Research for persistent chat)
  const [messages, setMessages] = useState([])
  const addMessage = (_, msg) => setMessages(prev => [...prev, msg])

  const [query, setQuery] = useState('')
  const [thinking, setThinking] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  const sendMessage = async () => {
    const q = query.trim()
    if (!q) return
    if (!apiKey) { notify('Connect your API key first', 'error'); return }

    setQuery('')
    setThinking(true)
    setStreamingText('')

    addMessage(source.id, { id: Date.now(), role: 'user', content: q, ts: new Date().toISOString() })

    let accumulated = ''
    try {
      await hyperResearchAnswer({
        query: q,
        chunks: allChunks,
        nodes,
        sources: allSources,
        apiKey,
        conversationHistory: messages,
        scope: source.id,
        onStream: chunk => {
          accumulated += chunk
          setStreamingText(accumulated)
        },
      })
      addMessage(source.id, { id: Date.now(), role: 'assistant', content: accumulated, ts: new Date().toISOString() })
    } catch (err) {
      addMessage(source.id, { id: Date.now(), role: 'assistant', content: `⚠️ Error: ${err.message}`, ts: new Date().toISOString() })
    }

    setStreamingText('')
    setThinking(false)
  }

  const filteredNodes = nodes.filter(n =>
    !searchQ ||
    n.concept.toLowerCase().includes(searchQ.toLowerCase()) ||
    n.tags?.some(t => t.includes(searchQ.toLowerCase()))
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 24px 14px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{source.title}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {source.author && <span>{source.author} · </span>}
              <span style={{ textTransform: 'capitalize' }}>{source.type}</span>
              {source.size_label && <span> · {source.size_label}</span>}
              <span> · {nodes.length} nodes · {chunks.length} chunks</span>
            </div>
          </div>
          <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 12px' }} onClick={onDelete}>
            🗑 Delete
          </button>
        </div>

        {source.summary && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, lineHeight: 1.6 }}>
            {source.summary}
          </div>
        )}

        {source.key_themes?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {source.key_themes.map(t => (
              <span key={t} style={{ fontSize: 11, padding: '3px 9px', background: 'var(--accent-light)', color: 'var(--accent-dark)', borderRadius: 20 }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
          {[
            { id: 'chat', label: '💬 Chat with Source' },
            { id: 'nodes', label: `◈ Nodes (${nodes.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 13,
                fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? 'var(--accent-dark)' : 'var(--text-muted)',
                background: tab === t.id ? 'var(--accent-light)' : 'transparent',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {messages.length === 0 && !thinking && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Chat with "{source.title}"
                </div>
                <div style={{ fontSize: 13 }}>Ask questions, get summaries, extract insights</div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className="fade-up" style={{
                display: 'flex', gap: 12, marginBottom: 18,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                maxWidth: 760, marginLeft: msg.role === 'user' ? 'auto' : undefined,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: msg.role === 'user' ? 'var(--bg-tertiary)' : 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: msg.role === 'user' ? 'var(--text-muted)' : '#fff',
                }}>
                  {msg.role === 'user' ? '◌' : '⬡'}
                </div>
                <div className="card" style={{
                  flex: 1, padding: '12px 16px',
                  borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  background: msg.role === 'user' ? 'var(--accent-light)' : '#fff',
                }}>
                  {msg.role === 'assistant' ? (
                    <div className="markdown-body" style={{ fontSize: 13.5, lineHeight: 1.8 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div style={{ display: 'flex', gap: 12, maxWidth: 760, marginBottom: 18 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', flexShrink: 0 }}>⬡</div>
                <div className="card" style={{ flex: 1, padding: '14px 16px' }}>
                  {streamingText ? (
                    <div className="markdown-body" style={{ fontSize: 13.5, lineHeight: 1.8 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                    </div>
                  ) : <ThinkingDots />}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-light)', background: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !thinking && sendMessage()}
                placeholder={`Ask about "${source.title}"…`}
                disabled={thinking}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={sendMessage} disabled={thinking || !query.trim()}>
                {thinking ? <Spinner size={16} color="#fff" /> : '→'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'nodes' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
          <div style={{ marginBottom: 14 }}>
            <input
              className="input"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search nodes…"
              style={{ maxWidth: 320 }}
            />
          </div>
          {filteredNodes.length === 0 ? (
            <EmptyState icon="◈" title="No nodes found" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {filteredNodes.map(n => <NodeCard key={n.id} node={n} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NodeCard({ node }) {
  const d = daysUntil(node.fsrs_state?.next_review_at)
  return (
    <div className="card card-hover" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <CatTag category={node.category} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <ConfidenceBadge value={node.confidence} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: d <= 0 ? '#EF4444' : d <= 3 ? '#F97316' : '#22C55E', fontWeight: 700 }}>
            {d <= 0 ? 'DUE' : `+${d}d`}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 8, fontWeight: 500 }}>
        {node.concept}
      </div>
      {node.applications && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: 8 }}>
          ↳ {node.applications}
        </div>
      )}
      {node.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {node.tags.map(t => (
            <span key={t} style={{ fontSize: 10, padding: '2px 7px', background: 'var(--bg-secondary)', borderRadius: 20, color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}