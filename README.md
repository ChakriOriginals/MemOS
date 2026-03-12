# MemOS — Neuro-Optimized Memory OS

> Not a note app. A neuro-optimized memory OS with HyperRAG intelligence.

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
# Click "Connect API Key" → enter your Anthropic key
```

## Project Structure

```
src/
├── App.jsx              # Root app + routing
├── styles.css           # Global design system
├── store/index.js       # Zustand store (FSRS + all state)
├── lib/
│   ├── hyperrag.js      # HyperRAG engine (7-layer AI retrieval)
│   └── constants.js     # Shared constants + utilities
├── components/
│   ├── UI.jsx           # Design primitives
│   ├── Sidebar.jsx      # Navigation
│   └── ApiKeyModal.jsx  # API setup
└── pages/
    ├── Dashboard.jsx    # Overview + stats
    ├── Ingest.jsx       # Document upload + extraction
    ├── Library.jsx      # Source browser + per-doc chat
    ├── Research.jsx     # HyperResearch global Q&A
    ├── Review.jsx       # FSRS-4.5 spaced recall
    ├── Graph.jsx        # Interactive knowledge graph
    ├── Analytics.jsx    # Memory health analytics
    └── Settings.jsx     # Config + export
```

## HyperRAG — 7 Layers Beyond Standard RAG

1. Semantic chunking (paragraph-boundary aware)
2. LLM query decomposition (complex → sub-queries)
3. BM25 multi-signal scoring (not just cosine similarity)
4. Multi-query fusion with score boosting
5. Adjacent chunk deduplication
6. Cross-source synthesis (all docs in one context window)
7. Memory node enrichment (structured knowledge layer)

## Swap to K2-Think-v2

In `src/lib/hyperrag.js` line 6-7:
```js
const CLAUDE_MODEL = 'MBZUAI-IFM/K2-Think-v2'
const CLAUDE_ENDPOINT = 'https://api.k2think.ai/v1/chat/completions'
```

## Build for Production

```bash
npm run build   # Output in dist/
```
