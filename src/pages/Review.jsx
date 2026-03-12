import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import useStore, { fsrsUpdate } from '../store'
import { generateRecallQuestion } from '../lib/hyperrag'
import { daysUntil, CAT_META } from '../lib/constants'
import { CatTag, ConfidenceBadge, Skeleton, EmptyState, ProgressBar } from '../components/UI'
import { useNavigate } from 'react-router-dom'

const RATINGS = [
  { id: 'again', label: 'Again',  color: '#EF4444', bg: '#FEE2E2', tip: 'Complete blackout — resets' },
  { id: 'hard',  label: 'Hard',   color: '#F59E0B', bg: '#FEF3C7', tip: 'Remembered with great difficulty' },
  { id: 'good',  label: 'Good',   color: '#10B981', bg: '#D1FAE5', tip: 'Recalled with some effort' },
  { id: 'easy',  label: 'Easy',   color: '#3B82F6', bg: '#DBEAFE', tip: 'Perfect recall — boost interval' },
]

export default function ReviewPage() {
  const navigate = useNavigate()
  const { nodes, apiKey, updateNode, notify } = useStore(s => ({
    nodes: s.nodes,
    apiKey: s.apiKey,
    updateNode: s.updateNode,
    notify: s.notify,
  }))

  const dueNodes = nodes.filter(n => daysUntil(n.fsrs_state?.next_review_at) <= 0)
  const [sessionActive, setSessionActive] = useState(false)
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [question, setQuestion] = useState(null)
  const [loadingQ, setLoadingQ] = useState(false)
  const [sessionResults, setSessionResults] = useState([])
  const [sessionDone, setSessionDone] = useState(false)

  const currentNode = queue[index]
  const progress = queue.length > 0 ? (index / queue.length) * 100 : 0

  const loadQuestion = useCallback(async (node) => {
    setLoadingQ(true)
    setQuestion(null)
    if (apiKey) {
      const q = await generateRecallQuestion(node, apiKey)
      setQuestion(q)
    } else {
      setQuestion({
        question_type: 'recall',
        question_text: `In your own words, explain: "${node.concept.slice(0, 120)}"`,
        ideal_answer_outline: node.applications || '',
      })
    }
    setLoadingQ(false)
  }, [apiKey])

  const startSession = () => {
    const q = [...dueNodes].sort(() => 0.5 - Math.random())
    setQueue(q)
    setIndex(0)
    setShowAnswer(false)
    setSessionResults([])
    setSessionDone(false)
    setSessionActive(true)
    if (q[0]) loadQuestion(q[0])
  }

  const handleRating = (rating) => {
    const updated = fsrsUpdate(currentNode.fsrs_state, rating)
    updateNode(currentNode.id, { fsrs_state: updated })
    setSessionResults(prev => [...prev, { nodeId: currentNode.id, rating, concept: currentNode.concept }])

    const next = index + 1
    if (next >= queue.length) {
      setSessionDone(true)
      setSessionActive(false)
      notify(`Review complete! Reviewed ${queue.length} nodes ✓`)
    } else {
      setIndex(next)
      setShowAnswer(false)
      setQuestion(null)
      loadQuestion(queue[next])
    }
  }

  // Session done
  if (sessionDone) {
    const ratingCounts = RATINGS.reduce((a, r) => { a[r.id] = sessionResults.filter(x => x.rating === r.id).length; return a }, {})
    return (
      <div className="fade-up" style={{ padding: '32px 36px', maxWidth: 600, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 8 }}>Session Complete!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>You reviewed {sessionResults.length} memory nodes</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
          {RATINGS.map(r => (
            <div key={r.id} style={{ textAlign: 'center', padding: '16px 8px', background: r.bg, borderRadius: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: r.color, fontFamily: 'var(--font-display)' }}>{ratingCounts[r.id]}</div>
              <div style={{ fontSize: 12, color: r.color, fontWeight: 500, textTransform: 'capitalize' }}>{r.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={startSession}>
            Review Again
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Active session
  if (sessionActive && currentNode) {
    return (
      <div className="fade-up" style={{ padding: '24px 36px', maxWidth: 700, margin: '0 auto' }}>
        {/* Progress header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            <span>Card {index + 1} of {queue.length}</span>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => { setSessionActive(false); setSessionDone(false) }}>
              Exit session
            </button>
          </div>
          <ProgressBar value={index} max={queue.length} color="linear-gradient(90deg, var(--accent), var(--purple))" height={8} />
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '28px 32px', marginBottom: 20, boxShadow: 'var(--shadow-md)' }}>
          {/* Meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <CatTag category={currentNode.category} size="md" />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{currentNode.fsrs_state?.review_count + 1} review</span>
              <ConfidenceBadge value={currentNode.confidence} />
            </div>
          </div>

          {/* Question */}
          <div style={{ minHeight: 90, marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              {loadingQ ? 'Generating question…' : question?.question_type?.replace(/_/g, ' ') || 'Question'}
            </div>
            {loadingQ ? (
              <div>
                <Skeleton height={22} style={{ marginBottom: 8 }} />
                <Skeleton height={22} width="80%" />
              </div>
            ) : (
              <div style={{ fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.7, fontWeight: 500 }}>
                {question?.question_text || `Explain: "${currentNode.concept.slice(0, 120)}…"`}
              </div>
            )}
          </div>

          {/* Source */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
            📄 {currentNode.source_ref?.title} {currentNode.source_ref?.timestamp && `· ${currentNode.source_ref.timestamp}`}
          </div>
        </div>

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            style={{
              width: '100%', padding: '15px', border: '2px solid var(--accent)',
              borderRadius: 12, fontSize: 15, fontWeight: 600, color: 'var(--accent)',
              background: 'transparent', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-light)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Reveal Answer
          </button>
        ) : (
          <div className="fade-in">
            {/* Answer */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: 12,
              padding: '20px 22px',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                ANSWER
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.75, fontWeight: 500, marginBottom: 12 }}>
                {currentNode.concept}
              </div>
              {currentNode.source_quote && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: 10, lineHeight: 1.6 }}>
                  "{currentNode.source_quote}"
                </div>
              )}
              {question?.ideal_answer_outline && (
                <div style={{ fontSize: 12, color: 'var(--accent-dark)', marginTop: 10, fontWeight: 500 }}>
                  💡 Key point: {question.ideal_answer_outline}
                </div>
              )}
              {currentNode.applications && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                  Application: {currentNode.applications}
                </div>
              )}
            </div>

            {/* FSRS preview */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 10 }}>
              How well did you recall this?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {RATINGS.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleRating(r.id)}
                  style={{
                    padding: '14px 8px', borderRadius: 12,
                    border: `2px solid ${r.color}`,
                    background: r.bg,
                    color: r.color,
                    fontSize: 13, fontWeight: 700,
                    textAlign: 'center', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = r.color; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = r.bg; e.currentTarget.style.color = r.color }}
                  title={r.tip}
                >
                  <div>{r.label}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 5, padding: '0 4px' }}>
              <span>← Resets interval</span>
              <span>Boosts interval →</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Pre-session screen
  return (
    <div className="fade-up" style={{ padding: '32px 36px', maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 6 }}>Recall Session</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>FSRS-4.5 spaced repetition with AI-generated Socratic questions</p>

      {dueNodes.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✨</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, fontFamily: 'var(--font-display)' }}>All caught up!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>No reviews due right now. Check back later or ingest more content.</p>
          <button className="btn btn-primary" onClick={() => navigate('/ingest')}>Ingest New Content</button>
        </div>
      ) : (
        <>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-light), #F0FDF4)',
            border: '1px solid var(--accent)',
            borderRadius: 16, padding: '28px', textAlign: 'center', marginBottom: 24,
          }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🧠</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 8 }}>
              {dueNodes.length} node{dueNodes.length > 1 ? 's' : ''} ready for review
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              ~{Math.ceil(dueNodes.length * 0.75)} minutes · {apiKey ? 'AI-generated questions' : 'Standard recall mode'}
            </div>
            <button className="btn btn-primary" style={{ padding: '14px 40px', fontSize: 16 }} onClick={startSession}>
              Begin Review →
            </button>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Today's Queue Preview</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dueNodes.slice(0, 8).map((n, i) => (
                <div key={n.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: i < Math.min(7, dueNodes.length - 1) ? '1px solid var(--border-light)' : 'none' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 22 }}>{i + 1}.</span>
                  <CatTag category={n.category} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{n.concept.slice(0, 75)}…</span>
                  <ConfidenceBadge value={n.confidence} />
                </div>
              ))}
              {dueNodes.length > 8 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 4 }}>
                  + {dueNodes.length - 8} more nodes
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
