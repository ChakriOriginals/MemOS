import { useState, useRef, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import useStore from '../store'
import { semanticChunk } from '../lib/hyperrag'
import { formatBytes } from '../lib/constants'
import { SectionHeader, Spinner, CatTag, ConfidenceBadge, EmptyState } from '../components/UI'

const ACCEPTED_TYPES = '.pdf,.txt,.md,.docx,.epub'
const CATEGORIES = ['fact','principle','framework','insight','warning','definition','example']

// ── Anthropic API call (identical to working MVP) ────────────────────────────
async function callAnthropic(apiKey, systemPrompt, userContent, maxTokens = 2000) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error?.message || `API error ${resp.status}`)
  return data.content?.map(i => i.text || '').join('') || ''
}

// ── Robust JSON parser (handles markdown fences and stray text) ───────────────
function parseJsonArray(text) {
  // 1. Strip markdown fences
  let s = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
  // 2. Try direct parse
  try { const p = JSON.parse(s); if (Array.isArray(p)) return p } catch {}
  // 3. Find the array in the text
  const m = s.match(/\[[\s\S]*\]/)
  if (m) { try { const p = JSON.parse(m[0]); if (Array.isArray(p)) return p } catch {} }
  return null
}

// ── File → plain text (no npm deps, pure browser APIs) ───────────────────────
async function readFileAsText(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  // Plain text files — just read directly
  if (['txt', 'md'].includes(ext)) {
    return await file.text()
  }

  // DOCX — use mammoth from CDN (injected once)
  if (['docx', 'doc'].includes(ext)) {
    return await extractDocx(file)
  }

  // PDF — use pdf.js from CDN (injected once)
  if (ext === 'pdf') {
    return await extractPdf(file)
  }

  // Fallback
  return await file.text()
}

// Inject a script tag once and return a promise that resolves when loaded
const _loaded = {}
function loadScript(url, globalKey) {
  if (_loaded[globalKey]) return _loaded[globalKey]
  _loaded[globalKey] = new Promise((resolve, reject) => {
    if (window[globalKey]) { resolve(window[globalKey]); return }
    const s = document.createElement('script')
    s.src = url
    s.onload = () => window[globalKey] ? resolve(window[globalKey]) : reject(new Error(`${globalKey} not found after load`))
    s.onerror = () => reject(new Error(`Failed to load ${url}`))
    document.head.appendChild(s)
  })
  return _loaded[globalKey]
}

async function extractPdf(file) {
  const pdfjs = await loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'pdfjsLib'
  )
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

  const buf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    let txt = ''
    for (const item of tc.items) {
      if (item.str) {
        txt += (txt && !txt.endsWith(' ') && !item.str.startsWith(' ') ? ' ' : '') + item.str
      }
    }
    if (txt.trim()) pages.push(txt.trim())
  }
  if (!pages.length) throw new Error('PDF has no selectable text. Use the Paste Text tab instead.')
  return pages.join('\n\n')
}

async function extractDocx(file) {
  const mammoth = await loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    'mammoth'
  )
  const buf = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  if (!result?.value?.trim()) throw new Error('DOCX appears empty or unreadable.')
  return result.value
}

// ── System prompt (identical structure to working MVP) ────────────────────────
const SYSTEM_PROMPT = `You are a precision knowledge distiller for MemOS, a memory compression system. Extract atomic, falsifiable, actionable memory nodes from the provided content.
Rules: (1) Each node must be independently meaningful. (2) Prefer specific over vague. (3) Extract 6-12 nodes. (4) Output ONLY a valid JSON array of nodes, no other text.
Schema: ${JSON.stringify({
  concept: 'One clear testable statement of the idea (max 250 chars)',
  category: 'one of [fact,principle,framework,insight,warning,definition,example]',
  confidence: '0.0-1.0',
  applications: 'When and how this idea is practically useful',
  source_quote: 'Verbatim quote max 50 words',
  tags: 'array of 2-4 lowercase keyword strings',
})}`

export default function IngestPage() {
  const { apiKey, addSource, updateSource, setChunks, addNodes, notify } = useStore(s => ({
    apiKey: s.apiKey,
    addSource: s.addSource,
    updateSource: s.updateSource,
    setChunks: s.setChunks,
    addNodes: s.addNodes,
    notify: s.notify,
  }))

  const [dragOver, setDragOver] = useState(false)
  const [activeJob, setActiveJob] = useState(null)
  const [extractedNodes, setExtractedNodes] = useState([])
  const [jobProgress, setJobProgress] = useState({ step: '', pct: 0 })
  const [manualText, setManualText] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const [tab, setTab] = useState('upload')
  const fileRef = useRef()

  const processFile = useCallback(async (file) => {
    if (!apiKey) { notify('Connect your API key first', 'error'); return }

    const sourceId = `src_${uuidv4().slice(0, 8)}`
    const source = {
      id: sourceId,
      title: file.name.replace(/\.[^.]+$/, ''),
      author: '',
      type: file.name.split('.').pop().toLowerCase(),
      size_label: formatBytes(file.size),
      created_at: new Date().toISOString(),
      node_count: 0,
      status: 'processing',
    }
    addSource(source)
    setActiveJob(sourceId)
    setExtractedNodes([])

    const prog = (step, pct) => setJobProgress({ step, pct })

    try {
      // Step 1: Extract text
      prog('Reading file…', 15)
      const rawText = await readFileAsText(file)
      if (!rawText || rawText.trim().length < 30) {
        throw new Error('No readable text found in file.')
      }
      prog(`Read ${rawText.length.toLocaleString()} characters`, 35)

      // Step 2: Chunk for RAG search (stored, not used for extraction)
      const chunks = semanticChunk(rawText, sourceId)
      setChunks(sourceId, chunks)
      prog(`Indexed ${chunks.length} chunks`, 50)

      // Step 3: Call Anthropic (same pattern as working MVP)
      prog('Extracting memory nodes…', 65)
      const userContent = `Title: ${source.title}\n\nContent:\n${rawText.slice(0, 10000)}`
      const raw = await callAnthropic(apiKey, SYSTEM_PROMPT, userContent, 2000)

      prog('Parsing nodes…', 85)
      const parsed = parseJsonArray(raw)

      if (!parsed || parsed.length === 0) {
        console.error('Raw API response:', raw)
        throw new Error('No nodes returned. Check your API key and try again.')
      }

      const finalNodes = parsed.map((n, i) => ({
        id: `n_${uuidv4().slice(0, 10)}`,
        source_id: sourceId,
        concept: n.concept || 'Untitled concept',
        category: CATEGORIES.includes(n.category) ? n.category : 'insight',
        confidence: typeof n.confidence === 'number' ? Math.min(1, Math.max(0, n.confidence)) : 0.8,
        applications: n.applications || '',
        source_quote: n.source_quote || '',
        tags: Array.isArray(n.tags) ? n.tags.slice(0, 4) : [],
        source_ref: {
          title: source.title,
          author: source.author || 'Unknown',
          source_type: source.type,
          timestamp: '',
          url: '',
        },
        fsrs_state: {
          stability: 1.0, difficulty: 0.3, ease_factor: 2.5,
          review_count: 0, last_review_at: null,
          next_review_at: new Date(Date.now() + 86400000).toISOString(),
          interval_days: 1,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      addNodes(finalNodes)
      updateSource(sourceId, { status: 'complete', node_count: finalNodes.length })
      setExtractedNodes(finalNodes)
      prog('Complete!', 100)
      notify(`✓ Extracted ${finalNodes.length} memory nodes from "${source.title}"`)

    } catch (err) {
      console.error('Ingest error:', err)
      updateSource(sourceId, { status: 'failed', error: err.message })
      notify(`Error: ${err.message}`, 'error')
      prog('', 0)
    }
    setActiveJob(null)
  }, [apiKey])

  const processManualText = async () => {
    if (!apiKey) { notify('Connect your API key first', 'error'); return }
    if (!manualText.trim()) { notify('Enter some content first', 'error'); return }
    const fakeFile = new File(
      [manualText],
      `${manualTitle || 'Manual Entry'}.txt`,
      { type: 'text/plain' }
    )
    await processFile(fakeFile)
    setManualText('')
    setManualTitle('')
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const files = [...e.dataTransfer.files]
    if (files[0]) processFile(files[0])
  }, [processFile])

  const onFileInput = (e) => {
    if (e.target.files[0]) processFile(e.target.files[0])
    e.target.value = ''
  }

  return (
    <div className="fade-up" style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <SectionHeader
        title="Ingest Content"
        subtitle="Upload documents, paste text, or add URLs — MemOS extracts atomic memory nodes automatically"
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: 4, borderRadius: 10, marginBottom: 24, width: 'fit-content' }}>
        {[{ id: 'upload', label: '📁 Upload File' }, { id: 'manual', label: '✏️ Paste Text' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--accent-dark)' : 'var(--text-muted)',
              background: tab === t.id ? '#fff' : 'transparent',
              boxShadow: tab === t.id ? 'var(--shadow)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24 }}>
        {/* Input panel */}
        <div>
          {tab === 'upload' && (
            <>
              <div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => !activeJob && fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 16,
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: activeJob ? 'not-allowed' : 'pointer',
                  background: dragOver ? 'var(--accent-light)' : 'var(--bg-primary)',
                  transition: 'all 0.2s',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {dragOver ? 'Drop to ingest' : 'Drop a file or click to upload'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  PDF, DOCX, TXT, MD — up to 50MB
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {['PDF', 'DOCX', 'TXT', 'MD'].map(ext => (
                    <span key={ext} style={{ padding: '3px 10px', background: 'var(--bg-secondary)', borderRadius: 20, fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{ext}</span>
                  ))}
                </div>
              </div>
              <input ref={fileRef} type="file" accept={ACCEPTED_TYPES} style={{ display: 'none' }} onChange={onFileInput} />
            </>
          )}

          {tab === 'manual' && (
            <div style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: '22px', border: '1px solid var(--border-light)' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Document Title
                </label>
                <input
                  className="input"
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  placeholder="e.g. Meeting Notes, Research Summary..."
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Content
                </label>
                <textarea
                  className="input"
                  value={manualText}
                  onChange={e => setManualText(e.target.value)}
                  placeholder="Paste your article, book notes, research, podcast transcript, or any text here..."
                  style={{ minHeight: 240, resize: 'vertical' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {manualText.split(/\s+/).filter(Boolean).length} words
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '13px', fontSize: 15, justifyContent: 'center' }}
                onClick={processManualText}
                disabled={!!activeJob}
              >
                {activeJob ? <><Spinner size={16} color="#fff" /> Processing…</> : '⊕ Extract Memory Nodes'}
              </button>
            </div>
          )}

          {/* Progress */}
          {activeJob && (
            <div className="card fade-in" style={{ padding: '20px', marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Spinner />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{jobProgress.step}</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3 }}>
                <div style={{
                  height: '100%',
                  width: `${jobProgress.pct}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--purple))',
                  borderRadius: 3,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                {jobProgress.pct}%
              </div>
            </div>
          )}
        </div>

        {/* Extracted nodes preview */}
        <div>
          <div className="card" style={{ padding: '20px', minHeight: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                Extracted Nodes
                {extractedNodes.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    ({extractedNodes.length})
                  </span>
                )}
              </h3>
            </div>

            {activeJob && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ height: 60, borderRadius: 10 }} className="shimmer" />
                ))}
              </div>
            )}

            {!activeJob && extractedNodes.length === 0 && (
              <EmptyState
                icon="◈"
                title="Nodes appear here"
                description="Upload a document and MemOS will extract atomic knowledge nodes using HyperRAG"
              />
            )}

            {extractedNodes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
                {extractedNodes.map((n, i) => (
                  <div key={n.id} className="fade-up" style={{
                    padding: '12px 14px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 10,
                    border: '1px solid var(--border-light)',
                    animationDelay: `${i * 0.05}s`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                      <CatTag category={n.category} />
                      <ConfidenceBadge value={n.confidence} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {n.concept}
                    </div>
                    {n.applications && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                        ↳ {n.applications}
                      </div>
                    )}
                    {n.tags?.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {n.tags.map(t => (
                          <span key={t} style={{ fontSize: 10, padding: '2px 7px', background: 'var(--accent-light)', color: 'var(--accent-dark)', borderRadius: 20 }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}