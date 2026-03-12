import { useState } from 'react'
import useStore from '../store'

export default function SettingsPage() {
  const { apiKey, setApiKey, nodes, sources, chunks, notify } = useStore(s => ({
    apiKey: s.apiKey,
    setApiKey: s.setApiKey,
    nodes: s.nodes,
    sources: s.sources,
    chunks: s.chunks || [],
    notify: s.notify,
  }))
  const [draftKey, setDraftKey] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)

  const exportData = () => {
    const data = { nodes, sources, chunks, exported_at: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'memos-export.json'; a.click()
    notify('Data exported successfully')
  }

  return (
    <div className="fade-up" style={{ padding: '32px 36px', maxWidth: 680 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)' }}>Settings</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Configure your MemOS instance</p>
      </div>

      {/* API Key */}
      <section className="card" style={{ padding: '24px', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>AI Engine</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Anthropic API key powers HyperResearch, concept extraction, and recall questions
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              className="input"
              type={showKey ? 'text' : 'password'}
              value={draftKey}
              onChange={e => setDraftKey(e.target.value)}
              placeholder="sk-ant-..."
            />
            <button
              onClick={() => setShowKey(s => !s)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)' }}
            >
              {showKey ? '🙈' : '👁'}
            </button>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { setApiKey(draftKey.trim()); notify(draftKey.trim() ? 'API key saved ✓' : 'API key removed') }}
          >
            Save
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          {apiKey
            ? '✓ Connected — key stored in browser localStorage, never transmitted to third parties'
            : '○ Not connected — AI features disabled'}
        </div>
      </section>

      {/* Data management */}
      <section className="card" style={{ padding: '24px', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Data</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {nodes.length} nodes · {sources.length} sources · {chunks.length} chunks indexed
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={exportData}>
            ↓ Export JSON
          </button>
        </div>
      </section>

      {/* About */}
      <section className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>About MemOS</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Version</span><span style={{ fontFamily: 'var(--font-mono)' }}>1.0.0</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>FSRS Algorithm</span><span style={{ fontFamily: 'var(--font-mono)' }}>4.5</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>AI Model</span><span style={{ fontFamily: 'var(--font-mono)' }}>claude-sonnet-4</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>RAG Strategy</span><span style={{ fontFamily: 'var(--font-mono)' }}>HyperRAG (BM25 + semantic)</span>
          </div>
        </div>
      </section>
    </div>
  )
}
