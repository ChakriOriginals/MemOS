import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import useStore from '../store'
import { hyperResearchAnswer } from '../lib/hyperrag'
import { SOURCE_ICONS, timeAgo } from '../lib/constants'
import { ThinkingDots, Spinner, EmptyState } from '../components/UI'

const SUGGESTED_QUESTIONS = [
  'What are the key principles across all my sources?',
  'Summarize the main ideas from my latest document',
  'What contradictions exist between my sources?',
  'What are the most actionable insights I should apply?',
  'Connect ideas across different sources in my library',
  'What topics should I research further based on my knowledge gaps?',
]

export default function ResearchPage() {
  const { apiKey, chunks, nodes, sources, researchChat, addResearchMessage, clearResearchChat, notify } = useStore(s => ({
    apiKey: s.apiKey,
    chunks: s.chunks || [],
    nodes: s.nodes,
    sources: s.sources,
    researchChat: s.researchChat,
    addResearchMessage: s.addResearchMessage,
    clearResearchChat: s.clearResearchChat,
    notify: s.notify,
  }))

  const [query, setQuery] = useState('')
  const [thinking, setThinking] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [activeScope, setActiveScope] = useState('all')
  const [showSources, setShowSources] = useState(false)
  const [lastMeta, setLastMeta] = useState(null)
  const bottomRef = useRef()
  const inputRef = useRef()
  const textareaRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [researchChat, streamingText])

  const sendMessage = async (q) => {
    const question = q || query.trim()
    if (!question) return
    if (!apiKey) { notify('Connect your API key to use HyperResearch', 'error'); return }

    setQuery('')
    setThinking(true)
    setStreamingText('')
    setLastMeta(null)

    addResearchMessage({ id: Date.now(), role: 'user', content: question, ts: new Date().toISOString() })

    let accumulated = ''
    try {
      const result = await hyperResearchAnswer({
        query: question,
        chunks,
        nodes,
        sources,
        apiKey,
        conversationHistory: researchChat,
        scope: activeScope,
        onStream: (chunk) => {
          accumulated += chunk
          setStreamingText(accumulated)
        },
      })

      addResearchMessage({
        id: Date.now(),
        role: 'assistant',
        content: accumulated,
        ts: new Date().toISOString(),
        meta: {
          sources_used: result.sources_used,
          sub_queries: result.sub_queries,
          chunks_retrieved: result.chunks_retrieved,
        },
      })
      setLastMeta(result)
    } catch (err) {
      addResearchMessage({
        id: Date.now(),
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message}\n\nPlease check your API key and try again.`,
        ts: new Date().toISOString(),
        error: true,
      })
    }

    setStreamingText('')
    setThinking(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const scopedSources = activeScope === 'all'
    ? sources
    : sources.filter(s => s.id === activeScope)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar panel */}
      <div style={{
        width: 280,
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 4 }}>⬡ HyperResearch</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI synthesis across your knowledge base</div>
        </div>

        {/* Scope selector */}
        <div style={{ padding: '14px 14px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Research Scope</div>
          <button
            onClick={() => setActiveScope('all')}
            style={{
              width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, marginBottom: 3,
              background: activeScope === 'all' ? 'var(--accent-light)' : 'transparent',
              color: activeScope === 'all' ? 'var(--accent-dark)' : 'var(--text-secondary)',
              fontWeight: activeScope === 'all' ? 600 : 400,
              fontSize: 13, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>◈</span>
            <span style={{ flex: 1 }}>All Sources</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{sources.length}</span>
          </button>

          {sources.map(src => (
            <button
              key={src.id}
              onClick={() => setActiveScope(src.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, marginBottom: 2,
                background: activeScope === src.id ? 'var(--accent-light)' : 'transparent',
                color: activeScope === src.id ? 'var(--accent-dark)' : 'var(--text-secondary)',
                fontWeight: activeScope === src.id ? 600 : 400,
                fontSize: 13, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 14 }}>📄</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                {src.title}
              </span>
            </button>
          ))}
        </div>

        {/* Suggested prompts */}
        <div style={{ padding: '14px', borderTop: '1px solid var(--border-light)', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Suggested Questions</div>
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              disabled={thinking}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)', transition: 'all 0.15s', lineHeight: 1.4,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Clear chat */}
        {researchChat.length > 0 && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-light)' }}>
            <button
              onClick={() => { clearResearchChat(); setLastMeta(null) }}
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
            >
              🗑 Clear conversation
            </button>
          </div>
        )}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {researchChat.length === 0 && !thinking && (
            <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>⬡</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 10 }}>
                HyperResearch
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
                Ask any question across your entire knowledge base. MemOS uses multi-query decomposition, semantic retrieval, and cross-source synthesis to give you cited, grounded answers — far beyond basic RAG.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {SUGGESTED_QUESTIONS.slice(0, 4).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    style={{
                      padding: '12px 14px', borderRadius: 10, fontSize: 13,
                      background: '#fff', border: '1px solid var(--border-light)',
                      color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.4,
                      transition: 'all 0.15s', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {researchChat.map((msg) => (
            <ChatMessage key={msg.id} message={msg} sources={sources} />
          ))}

          {thinking && (
            <div style={{ display: 'flex', gap: 14, maxWidth: 820, marginBottom: 24 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: '#fff',
              }}>⬡</div>
              <div className="card" style={{ flex: 1, padding: '16px 20px' }}>
                {streamingText ? (
                  <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.8 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                    <span style={{ display: 'inline-block', width: 2, height: 16, background: 'var(--accent)', marginLeft: 2, animation: 'pulse 1s infinite' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ThinkingDots />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analyzing your knowledge base…</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{
          padding: '16px 24px',
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border-light)',
        }}>
          {/* Research metadata */}
          {lastMeta && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', background: 'var(--bg-secondary)', borderRadius: 20 }}>
                🔍 {lastMeta.chunks_retrieved} chunks retrieved
              </span>
              {lastMeta.sub_queries?.length > 1 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', background: 'var(--bg-secondary)', borderRadius: 20 }}>
                  ⬡ {lastMeta.sub_queries.length} sub-queries
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', background: 'var(--bg-secondary)', borderRadius: 20 }}>
                📚 {scopedSources.length} source{scopedSources.length !== 1 ? 's' : ''} searched
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={inputRef}
                className="input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything across your knowledge base… (Enter to send, Shift+Enter for newline)"
                style={{ minHeight: 52, maxHeight: 160, resize: 'none', paddingRight: 50, fontSize: 14, lineHeight: 1.5 }}
                disabled={thinking}
                rows={1}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ padding: '13px 20px', alignSelf: 'flex-end', opacity: thinking ? 0.6 : 1 }}
              onClick={() => sendMessage()}
              disabled={thinking || !query.trim()}
            >
              {thinking ? <Spinner size={16} color="#fff" /> : '→'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
            Scope: <strong>{activeScope === 'all' ? 'All sources' : sources.find(s => s.id === activeScope)?.title || 'Selected'}</strong>
            {' · '}{chunks.length} chunks indexed · {nodes.length} memory nodes
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatMessage({ message, sources }) {
  const [showMeta, setShowMeta] = useState(false)
  const isUser = message.role === 'user'

  return (
    <div className="fade-up" style={{
      display: 'flex',
      gap: 14,
      maxWidth: 820,
      marginBottom: 24,
      flexDirection: isUser ? 'row-reverse' : 'row',
      marginLeft: isUser ? 'auto' : undefined,
    }}>
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: isUser ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent), var(--purple))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isUser ? 16 : 16, color: isUser ? 'var(--text-muted)' : '#fff',
        alignSelf: 'flex-start',
      }}>
        {isUser ? '◌' : '⬡'}
      </div>

      <div style={{ flex: 1 }}>
        {isUser ? (
          <div style={{
            padding: '12px 16px',
            background: 'var(--accent-light)',
            borderRadius: '14px 14px 4px 14px',
            fontSize: 14,
            color: 'var(--text-primary)',
            fontWeight: 500,
            lineHeight: 1.6,
          }}>
            {message.content}
          </div>
        ) : (
          <div>
            <div className="card" style={{ padding: '18px 22px', borderRadius: '4px 14px 14px 14px' }}>
              <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.8 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            </div>

            {/* Source citations */}
            {message.meta?.sources_used?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setShowMeta(!showMeta)}
                  style={{
                    fontSize: 11, color: 'var(--text-muted)', padding: '4px 10px',
                    background: 'var(--bg-tertiary)', borderRadius: 20, display: 'flex',
                    alignItems: 'center', gap: 5, transition: 'all 0.15s',
                  }}
                >
                  <span>{showMeta ? '▾' : '▸'}</span>
                  {message.meta.chunks_retrieved} chunks retrieved
                  {message.meta.sub_queries?.length > 1 && ` · ${message.meta.sub_queries.length} sub-queries`}
                </button>
                {showMeta && (
                  <div className="fade-in" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {message.meta.sub_queries?.length > 1 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                        <strong>Sub-queries:</strong> {message.meta.sub_queries.join(' · ')}
                      </div>
                    )}
                    {message.meta.sources_used.slice(0, 4).map((s, i) => {
                      const src = sources.find(x => x.id === s.source_id)
                      return (
                        <div key={i} style={{
                          padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8,
                          fontSize: 11, color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent)',
                        }}>
                          <strong>[SOURCE {i + 1}]</strong> {src?.title || 'Unknown'} — {s.preview}…
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: isUser ? 'right' : 'left' }}>
          {timeAgo(message.ts)}
        </div>
      </div>
    </div>
  )
}
