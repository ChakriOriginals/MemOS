import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

// ── FSRS-4.5 simplified implementation ──────────────────────────────────────
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

// ── Initial demo data ───────────────────────────────────────────────────────
const DEMO_SOURCE = {
  id: 'src_demo',
  title: 'Make It Stick — The Science of Successful Learning',
  author: 'Peter C. Brown, Henry L. Roediger III',
  type: 'book',
  url: '',
  created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  chunks: [],
  node_count: 4,
  status: 'complete',
  size_label: '2.3 MB',
}

const DEMO_NODES = [
  {
    id: 'n_demo1',
    source_id: 'src_demo',
    concept: 'Spaced repetition exploits the spacing effect: reviewing information at increasing intervals dramatically improves long-term retention compared to massed practice.',
    category: 'principle',
    confidence: 0.97,
    applications: 'Schedule reviews of all critical knowledge using FSRS or SM-2 algorithms.',
    source_quote: 'The spacing effect is one of the most robust findings in all of cognitive psychology.',
    source_ref: { title: 'Make It Stick', author: 'Brown et al.', source_type: 'book', timestamp: 'p.47' },
    tags: ['memory', 'spaced-repetition', 'learning'],
    fsrs_state: { stability: 4.2, difficulty: 0.28, review_count: 3, next_review_at: new Date(Date.now() + 2 * 86400000).toISOString(), interval_days: 8 },
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 'n_demo2',
    source_id: 'src_demo',
    concept: 'Retrieval practice (testing yourself) produces better long-term learning than re-reading — the "testing effect" or "retrieval effect".',
    category: 'principle',
    confidence: 0.96,
    applications: 'Replace passive re-reading with active recall: flashcards, practice problems, self-quizzing.',
    source_quote: 'Testing, not studying, is the key to durable learning.',
    source_ref: { title: 'Make It Stick', author: 'Brown et al.', source_type: 'book', timestamp: 'p.28' },
    tags: ['retrieval', 'testing', 'learning'],
    fsrs_state: { stability: 6.8, difficulty: 0.22, review_count: 5, next_review_at: new Date(Date.now() - 1 * 86400000).toISOString(), interval_days: 14 },
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 'n_demo3',
    source_id: 'src_demo',
    concept: 'Interleaved practice — mixing different problem types — feels harder but produces superior learning outcomes versus blocked (massed) practice of one type.',
    category: 'insight',
    confidence: 0.88,
    applications: 'Alternate between different skill types during practice sessions.',
    source_quote: 'Interleaving feels unproductive but measurably accelerates mastery.',
    source_ref: { title: 'Make It Stick', author: 'Brown et al.', source_type: 'book', timestamp: 'p.65' },
    tags: ['interleaving', 'practice', 'learning'],
    fsrs_state: { stability: 3.3, difficulty: 0.41, review_count: 2, next_review_at: new Date(Date.now() - 2 * 86400000).toISOString(), interval_days: 4 },
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'n_demo4',
    source_id: 'src_demo',
    concept: 'Elaborative interrogation — asking "why" and "how" about new material — significantly improves comprehension by building more retrieval pathways.',
    category: 'framework',
    confidence: 0.85,
    applications: 'For every concept, ask: Why is this true? How does it connect to what I know?',
    source_quote: 'Elaboration creates more retrieval pathways for the same information.',
    source_ref: { title: 'Make It Stick', author: 'Brown et al.', source_type: 'book', timestamp: 'p.88' },
    tags: ['elaboration', 'comprehension', 'questioning'],
    fsrs_state: { stability: 5.1, difficulty: 0.31, review_count: 4, next_review_at: new Date(Date.now() + 10 * 86400000).toISOString(), interval_days: 10 },
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
]

// ── Store ───────────────────────────────────────────────────────────────────
const useStore = create(
  persist(
    (set, get) => ({
      // Auth / Settings
      apiKey: '',
      setApiKey: (key) => set({ apiKey: key }),

      // Sources (uploaded documents)
      sources: [DEMO_SOURCE],
      addSource: (src) => set(s => ({ sources: [src, ...s.sources] })),
      updateSource: (id, patch) => set(s => ({ sources: s.sources.map(x => x.id === id ? { ...x, ...patch } : x) })),
      removeSource: (id) => set(s => ({
        sources: s.sources.filter(x => x.id !== id),
        nodes: s.nodes.filter(x => x.source_id !== id),
        chunks: (s.chunks || []).filter(x => x.source_id !== id),
      })),

      // Document chunks (for RAG)
      chunks: [],
      setChunks: (sourceId, newChunks) => set(s => ({
        chunks: [...(s.chunks || []).filter(c => c.source_id !== sourceId), ...newChunks]
      })),

      // Memory nodes
      nodes: DEMO_NODES,
      addNodes: (newNodes) => set(s => ({ nodes: [...newNodes, ...s.nodes] })),
      updateNode: (id, patch) => set(s => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, ...patch } : n) })),
      removeNode: (id) => set(s => ({ nodes: s.nodes.filter(n => n.id !== id) })),

      // Chat history per source
      chats: {},
      addMessage: (sourceId, message) => set(s => ({
        chats: {
          ...s.chats,
          [sourceId]: [...(s.chats[sourceId] || []), message]
        }
      })),
      clearChat: (sourceId) => set(s => ({
        chats: { ...s.chats, [sourceId]: [] }
      })),

      // Global research chat
      researchChat: [],
      addResearchMessage: (msg) => set(s => ({ researchChat: [...s.researchChat, msg] })),
      clearResearchChat: () => set({ researchChat: [] }),

      // Ingestion jobs
      jobs: [],
      addJob: (job) => set(s => ({ jobs: [job, ...s.jobs] })),
      updateJob: (id, patch) => set(s => ({ jobs: s.jobs.map(j => j.id === id ? { ...j, ...patch } : j) })),

      // UI state
      activeSource: null,
      setActiveSource: (id) => set({ activeSource: id }),

      notification: null,
      notify: (msg, type = 'success') => {
        set({ notification: { msg, type, id: Date.now() } })
        setTimeout(() => set({ notification: null }), 4000)
      },
    }),
    {
      name: 'memos-storage',
      partialize: (s) => ({
        apiKey: s.apiKey,
        sources: s.sources,
        chunks: s.chunks,
        nodes: s.nodes,
        chats: s.chats,
        researchChat: s.researchChat,
        jobs: s.jobs,
      }),
    }
  )
)

export default useStore
