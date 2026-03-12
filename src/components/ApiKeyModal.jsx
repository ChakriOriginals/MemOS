import { useState } from 'react'
import { Modal } from './UI'
import useStore from '../store'

export default function ApiKeyModal({ open, onClose }) {
  const { apiKey, setApiKey, notify } = useStore(s => ({
    apiKey: s.apiKey,
    setApiKey: s.setApiKey,
    notify: s.notify,
  }))
  const [draft, setDraft] = useState(apiKey)

  const save = () => {
    setApiKey(draft.trim())
    notify(draft.trim() ? 'API key saved ✓' : 'API key removed')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={480}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Connect API Key</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Enter your Anthropic API key to enable all AI features</p>
        </div>
        <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
          Anthropic API Key
        </label>
        <input
          className="input"
          type="password"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="sk-ant-..."
          onKeyDown={e => e.key === 'Enter' && save()}
          autoFocus
        />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          🔒 Stored locally in your browser only. Sent exclusively to api.anthropic.com
        </p>
      </div>

      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Powered by Claude claude-sonnet-4-20250514:</div>
        {[
          '⊕  Smart ingestion — Concept extraction from any document',
          '⬡  HyperResearch — Multi-document Q&A with citation grounding',
          '◎  Recall questions — AI-generated Socratic review prompts',
          '✦  Contradiction detection — Cross-source knowledge conflicts',
        ].map(f => (
          <div key={f} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{f}</div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>
          {draft ? 'Save & Activate' : 'Save'}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 14 }}>
        Model: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>claude-sonnet-4-20250514</span>
        {' · '}Endpoint: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>api.anthropic.com</span>
      </p>
    </Modal>
  )
}