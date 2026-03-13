import { create } from 'zustand'
import * as api from '../lib/api'

// ── FSRS-4.5 ──────────────────────────────────────────────────────────────────
export function fsrsUpdate(state, rating) {
  const r = { again: 1, hard: 2, good: 3, easy: 4 }[rating]
  let { stability = 1, difficulty = 0.3 } = state
  const newDiff = Math.max(0.1, Math.min(1.0, difficulty + 0.1 * (3 - r)))
  let newStab
  if (r === 1) {
    newStab = Math.max(0.5, stability * 0.2)
  } else {
    newStab = stability * (1 + Math.exp(0.9) * (11 - newDiff) *
      Math.pow(stability, -0.5) * (Math.exp((1 - r / 4) * 0.9) - 1) * 0.1 + r * 0.05)
  }
  const interval = Math.max(1, Math.round(newStab * 9 / 19))
  return {
    stability: +newStab.toFixed(2),
    difficulty: +newDiff.toFixed(2),
    ease_factor: 2.5,
    review_count: (state.review_count || 0) + 1,
    last_review_at: new Date().toISOString(),
    next_review_at: new Date(Date.now() + interval * 86400000).toISOString(),
    interval_days: interval,
  }
}

const DEMO_SOURCE = {
  id: 'src_demo',
  title: 'Make It Stick — The Science of Successful Learning',
  author: 'Peter C. Brown, Henry L. Roediger III',
  type: 'book', size_label: '2.3 MB', status: 'complete', node_count: 4, metadata: {},
}

const DEMO_NODES = [
  { id: 'n_demo1', source_id: 'src_demo', category: 'principle', confidence: 0.97,
    concept: 'Spaced repetition exploits the spacing effect: reviewing information at increasing intervals dramatically improves long-term retention compared to massed practice.',
    applications: 'Schedule reviews of all critical knowledge using FSRS or SM-2 algorithms.',
    source_quote: 'The spacing effect is one of the most robust findings in all of cognitive psychology.',
    source_ref: { title: 'Make It Stick', author: 'Brown et al.', source_type: 'book', timestamp: 'p.47' },
    tags: ['memory', 'spaced-repetition', 'learning'],
    fsrs_state: { stability: 4.2, difficulty: 0.28, review_count: 3, next_review_at: new Date(Date.now() + 2*86400000).toISOString(), interval_days: 8 },
    created_at: new Date(Date.now() - 12*86400000).toISOString() },
  { id: 'n_demo2', source_id: 'src_demo', category: 'principle', confidence: 0.96,
    concept: 'Retrieval practice (testing yourself) produces better long-term learning than re-reading — the "testing effect".',
    applications: 'Replace passive re-reading with active recall: flashcards, practice problems, self-quizzing.',
    source_quote: 'Testing, not studying, is the key to durable learning.',
    source_ref: { title: 'Make It Stick', author: 'Brown et al.', source_type: 'book', timestamp: 'p.28' },
    tags: ['retrieval', 'testing', 'learning'],
    fsrs_state: { stability: 6.8, difficulty: 0.22, review_count: 5, next_review_at: new Date(Date.now() - 1*86400000).toISOString(), interval_days: 14 },
    created_at: new Date(Date.now() - 14*86400000).toISOString() },
  { id: 'n_demo3', source_id: 'src_demo', category: 'insight', confidence: 0.88,
    concept: 'Interleaved practice — mixing different problem types — feels harder but produces superior learning outcomes.',
    applications: 'Alternate between different skill types during practice sessions.',
    source_quote: 'Interleaving feels unproductive but measurably accelerates mastery.',
    source_ref: { title: 'Make It Stick', author: 'Brown et al.', source_type: 'book', timestamp: 'p.65' },
    tags: ['interleaving', 'practice', 'learning'],
    fsrs_state: { stability: 3.3, difficulty: 0.41, review_count: 2, next_review_at: new Date(Date.now() - 2*86400000).toISOString(), interval_days: 4 },
    created_at: new Date(Date.now() - 10*86400000).toISOString() },
  { id: 'n_demo4', source_id: 'src_demo', category: 'framework', confidence: 0.85,
    concept: 'Elaborative interrogation — asking "why" and "how" about new material — significantly improves comprehension.',
    applications: 'For every concept, ask: Why is this true? How does it connect to what I know?',
    source_quote: 'Elaboration creates more retrieval pathways for the same information.',
    source_ref: { title: 'Make It Stick', author: 'Brown et al.', source_type: 'book', timestamp: 'p.88' },
    tags: ['elaboration', 'comprehension', 'questioning'],
    fsrs_state: { stability: 5.1, difficulty: 0.31, review_count: 4, next_review_at: new Date(Date.now() + 10*86400000).toISOString(), interval_days: 10 },
    created_at: new Date(Date.now() - 12*86400000).toISOString() },
]

const useStore = create((set, get) => ({
  apiKey: '', sources: [], chunks: [], nodes: [], researchChat: [], jobs: [],
  activeSource: null, dbReady: false, notification: null,

  notify: (msg, type = 'success') => {
    set({ notification: { msg, type, id: Date.now() } })
    setTimeout(() => set({ notification: null }), 4000)
  },

  bootstrap: async () => {
    try {
      const [sources, chunks, nodes, chat, keyRes] = await Promise.all([
        api.getSources(), api.getChunks(), api.getNodes(), api.getChat(),
        api.getSetting('apiKey').catch(() => ({ value: '' })),
      ])
      if (sources.length === 0) {
        await api.createSource(DEMO_SOURCE)
        await api.saveNodes(DEMO_NODES)
        const [s2, n2] = await Promise.all([api.getSources(), api.getNodes()])
        set({ sources: s2, nodes: n2, chunks: [], researchChat: [], apiKey: keyRes?.value || '', dbReady: true })
        return
      }
      set({ sources, chunks, nodes, researchChat: chat, apiKey: keyRes?.value || '', dbReady: true })
    } catch (err) {
      console.error('Bootstrap failed:', err.message)
      set({ dbReady: true })
    }
  },

  setApiKey: async (key) => {
    set({ apiKey: key })
    try { await api.setSetting('apiKey', key) } catch {}
  },

  addSource: async (src) => {
    set(s => ({ sources: [src, ...s.sources] }))
    try { await api.createSource(src) } catch {}
  },
  updateSource: async (id, patch) => {
    set(s => ({ sources: s.sources.map(x => x.id === id ? { ...x, ...patch } : x) }))
    try { await api.updateSource(id, patch) } catch {}
  },
  removeSource: async (id) => {
    set(s => ({
      sources: s.sources.filter(x => x.id !== id),
      nodes: s.nodes.filter(x => x.source_id !== id),
      chunks: s.chunks.filter(x => x.source_id !== id),
    }))
    try { await api.deleteSource(id) } catch {}
  },

  setChunks: async (sourceId, newChunks) => {
    set(s => ({ chunks: [...s.chunks.filter(c => c.source_id !== sourceId), ...newChunks] }))
    try { await api.saveChunks(sourceId, newChunks) } catch {}
  },

  addNodes: async (newNodes) => {
    set(s => ({ nodes: [...newNodes, ...s.nodes] }))
    try { await api.saveNodes(newNodes) } catch {}
  },
  updateNode: async (id, patch) => {
    set(s => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, ...patch } : n) }))
    try { await api.updateNode(id, patch) } catch {}
  },
  removeNode: async (id) => {
    set(s => ({ nodes: s.nodes.filter(n => n.id !== id) }))
    try { await api.deleteNode(id) } catch {}
  },

  addResearchMessage: async (msg) => {
    set(s => ({ researchChat: [...s.researchChat, msg] }))
    try { await api.postMessage(msg) } catch {}
  },
  clearResearchChat: async () => {
    set({ researchChat: [] })
    try { await api.clearChat() } catch {}
  },

  addJob: (job) => set(s => ({ jobs: [job, ...s.jobs] })),
  updateJob: (id, patch) => set(s => ({ jobs: s.jobs.map(j => j.id === id ? { ...j, ...patch } : j) })),
  setActiveSource: (id) => set({ activeSource: id }),
}))

export default useStore