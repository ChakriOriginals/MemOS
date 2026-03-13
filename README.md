# ⬡ MemOS — Memory Operating System

> **Turn any document into a living knowledge graph. AI-powered ingestion, spaced recall, and research — all in one app.**

MemOS is a personal knowledge management system that extracts atomic memory nodes from your documents, schedules them for spaced repetition review using the FSRS-4.5 algorithm, and lets you research across your entire knowledge base with AI-powered Q&A. All data is stored permanently in PostgreSQL (Neon) — nothing is lost when you close the browser.

---

## Table of Contents

1. [What MemOS Does](#what-memos-does)
2. [Tech Stack](#tech-stack)
3. [Project Directory](#project-directory)
4. [Prerequisites](#prerequisites)
5. [Local Setup Guide](#local-setup-guide)
6. [Deployment Guide (Vercel)](#deployment-guide-vercel)
7. [User Manual](#user-manual)
8. [Node Categories Explained](#node-categories-explained)
9. [FSRS-4.5 Spaced Repetition](#fsrs-45-spaced-repetition)
10. [Important Things to Know](#important-things-to-know)
11. [Troubleshooting](#troubleshooting)

---

## What MemOS Does

| Feature | Description |
|---------|-------------|
| **Smart Ingestion** | Upload PDF, DOCX, or TXT files. Claude AI extracts 6–12 atomic memory nodes from each document automatically |
| **HyperResearch** | Ask any question across your entire knowledge base. AI retrieves relevant chunks and generates cited answers |
| **Spaced Recall** | FSRS-4.5 algorithm schedules each node for review at the optimal time to maximize long-term retention |
| **Knowledge Graph** | Visual interactive graph showing all your nodes clustered by category with relationship edges |
| **Library** | Browse all uploaded sources, view their extracted nodes, and chat with individual documents |
| **Analytics** | Memory health dashboard — retention scores, review buckets, knowledge coverage by category |
| **Permanent Storage** | All data lives in PostgreSQL. Survives browser clears, device switches, and months of inactivity |

---

## Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 + Vite | UI framework and build tool |
| Zustand | State management (syncs to Postgres) |
| React Router v6 | Client-side routing |
| ReactMarkdown + remark-gfm | Markdown rendering in chat |
| mammoth | DOCX file parsing |

### Backend
| Technology | Purpose |
|-----------|---------|
| Node.js + Express | REST API server (local dev) |
| Vercel Serverless Functions | REST API (production) |
| PostgreSQL via Neon | Permanent database |
| pg | PostgreSQL client |

### AI
| Service | Purpose |
|---------|---------|
| Claude Sonnet 4.5 | Document ingestion + node extraction |
| Claude Sonnet 4.5 | HyperResearch Q&A (streaming) |
| Claude Sonnet 4.5 | Recall question generation |

### Deployment
| Service | Purpose |
|---------|---------|
| Vercel | Frontend + serverless API (free) |
| Neon | PostgreSQL database (free, permanent) |

---

## Project Directory

```
memos/
│
├── package.json              # Root dependencies + npm scripts
├── vite.config.js            # Vite config + local dev proxy
├── vercel.json               # Vercel deployment config
├── render.yaml               # Render deployment config (alternative)
├── .env                      # Frontend env vars (gitignored)
├── .gitignore                # Excludes .env, node_modules, dist
├── DEPLOY.md                 # Step-by-step deployment guide
├── README.md                 # This file
│
├── api/                      # Vercel serverless API routes
│   ├── _lib/
│   │   └── db.js             # Shared Postgres pool + schema init + CORS
│   ├── health.js             # GET /api/health
│   ├── settings/
│   │   └── [key].js          # GET/PUT /api/settings/:key
│   ├── sources/
│   │   ├── index.js          # GET all, POST new source
│   │   └── [id].js           # PATCH, DELETE source by ID
│   ├── chunks/
│   │   ├── index.js          # GET chunks (optionally by source)
│   │   └── bulk.js           # POST bulk save chunks
│   ├── nodes/
│   │   ├── index.js          # GET all nodes, POST bulk save
│   │   └── [id].js           # PATCH, DELETE node by ID
│   └── chat/
│       └── index.js          # GET/POST/DELETE research chat
│
├── server/                   # Local Express server (dev only)
│   ├── index.js              # Express server with all endpoints
│   ├── schema.sql            # PostgreSQL table definitions
│   ├── package.json          # Server dependencies
│   ├── .env                  # Local secrets — NEVER commit this
│   └── .env.example          # Template for .env
│
└── src/                      # React frontend
    ├── App.jsx               # Root app + routing
    ├── main.jsx              # Entry point — bootstraps DB data
    ├── styles.css            # Global design system + SF Pro font
    │
    ├── store/
    │   └── index.js          # Zustand store — state + Postgres sync
    │
    ├── lib/
    │   ├── hyperrag.js       # BM25 retrieval + Anthropic streaming
    │   ├── api.js            # REST client for all API calls
    │   └── constants.js      # Categories, icons, utility functions
    │
    ├── components/
    │   ├── UI.jsx            # Modal, Toast, StatCard, CatTag, etc.
    │   ├── Sidebar.jsx       # Left navigation
    │   └── ApiKeyModal.jsx   # API key setup with validation
    │
    └── pages/
        ├── Dashboard.jsx     # Stats overview + due cards
        ├── Ingest.jsx        # Document upload + extraction
        ├── Library.jsx       # Source browser + node viewer
        ├── Research.jsx      # HyperResearch AI Q&A
        ├── Review.jsx        # FSRS spaced recall sessions
        ├── Graph.jsx         # Interactive knowledge graph
        ├── Analytics.jsx     # Memory health analytics
        └── Settings.jsx      # Config + data export
```

---

## Prerequisites

| Requirement | Where to get it | Cost |
|------------|----------------|------|
| Node.js 18+ | https://nodejs.org | Free |
| Anthropic API key | https://console.anthropic.com | Pay per use (~$0.01–0.05/day) |
| Neon Postgres database | https://neon.tech | Free forever |
| GitHub account | https://github.com | Free |
| Vercel account | https://vercel.com | Free |

---

## Local Setup Guide

### Step 1 — Install dependencies

```powershell
cd "D:\your-folder\memos"

# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

### Step 2 — Create server/.env

```powershell
copy server\.env.example server\.env
```

Edit `server/.env`:
```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### Step 3 — Run both servers (two terminals)

**Terminal 1:**
```powershell
npm run dev:server
# → ✓ Database schema ready
# → ✓ MemOS server running on port 3001
```

**Terminal 2:**
```powershell
npm run dev
# → VITE v5.x.x ready
# → http://localhost:5173/
```

### Step 4 — Open and configure

1. Go to **http://localhost:5173**
2. Click **"Connect API Key"** in the bottom left
3. Enter your Anthropic key (`sk-ant-api03-...`)
4. Click **Save & Activate**

---

## Deployment Guide (Vercel)

### Step 1 — Push to GitHub

```powershell
git add .
git commit -m "MemOS ready for deploy"
git push
```

### Step 2 — Deploy on Vercel

1. Go to **https://vercel.com** → Sign up with GitHub
2. **New Project** → Import your `memos` repo
3. Leave all settings default → **Deploy**

### Step 3 — Add DATABASE_URL

1. Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add `DATABASE_URL` = your Neon connection string
3. **Save** → **Redeploy**

Your app is live at `https://memos-xxxxxxx.vercel.app` 🎉

---

## User Manual

### ⊕ Ingesting a Document

1. Click **Ingest** in the sidebar
2. Drop your file (PDF, DOCX, TXT, or MD) onto the upload area
3. Add a title and optional author
4. Click **"Extract Memory Nodes"**
5. Wait ~10–20 seconds — Claude reads the document and extracts nodes
6. Nodes are saved to the database and immediately usable

**Tips:**
- Text-based PDFs work best. Scanned image PDFs may produce fewer nodes.
- DOCX files are converted to plain text before extraction.
- Large documents (50+ pages) may take longer — be patient.

---

### ◈ Library

1. Click **Library** → select any document from the left panel
2. **Chat tab** — ask questions about this specific document (session only, not saved)
3. **Nodes tab** — browse all extracted memory nodes, filter by keyword
4. Click **🗑 Delete** to permanently remove a source and all its nodes

---

### ⬡ HyperResearch

1. Click **HyperResearch** in the sidebar
2. Type your question and press **Enter**
3. MemOS searches your knowledge base using BM25 retrieval
4. Claude streams a cited answer referencing `[SOURCE 1]`, `[SOURCE 2]` etc.
5. Use **Research Scope** (left panel) to search within a specific document
6. All conversation history is **permanently saved** to the database

**Best practices:**
- Be specific in your questions for more accurate retrieval
- Use scope filtering when you want answers from a single document
- The suggested questions in the left panel are good starting points

---

### ◎ Recall — Spaced Repetition

1. Click **Recall** → see how many nodes are due
2. **Start Review Session**
3. Read the AI-generated recall question for each node
4. Think of your answer, then click **Show Answer**
5. Rate your recall:
   - **Again** — forgot completely → short interval
   - **Hard** — struggled to remember → small increase
   - **Good** — recalled with effort → normal increase
   - **Easy** — instant recall → large interval boost
6. FSRS calculates your next review date automatically

---

### ✦ Knowledge Graph

- **Drag** nodes to rearrange
- **Click** a node to see details
- **Scroll** to zoom, **drag empty space** to pan
- Filter by category or source using the top controls
- Edge colors: 🟢 Supports · 🔴 Contradicts · 🔵 Extends · 🟠 Requires

---

### ▦ Analytics

Live memory health metrics:
- Retention distribution across time buckets
- Knowledge coverage by node category
- Average stability score per source
- Nodes reviewed vs. total

---

### ⚙ Settings

- Update your Anthropic API key
- Export all data as JSON backup
- View version and model info

---

## Node Categories Explained

| Category | When Claude uses it | Example |
|----------|-------------------|---------|
| **Fact** | Specific verifiable information | *"Ebbinghaus documented the spacing effect in 1885"* |
| **Principle** | Broad rules that apply widely | *"Spaced repetition outperforms massed practice for long-term retention"* |
| **Framework** | Structured models or systems | *"FSRS uses stability + difficulty to schedule reviews"* |
| **Insight** | Non-obvious connections or observations | *"Interleaving feels unproductive but measurably accelerates mastery"* |
| **Warning** | Pitfalls, mistakes, or caveats | *"Highlighting creates an illusion of learning without improving retention"* |
| **Definition** | Precise meaning of a term | *"Retrieval practice: actively recalling information, distinct from recognition"* |
| **Example** | Concrete illustration of a concept | *"A student doing mixed math+history outperforms one doing all math then all history"* |

---

## FSRS-4.5 Spaced Repetition

Each node tracks two parameters:

- **Stability (S)** — how long before you forget it. Higher = longer intervals.
- **Difficulty (D)** — how hard it is to remember. Scale 0.1 (easy) to 1.0 (very hard).

**Rating effects:**

| Rating | Stability change | Difficulty change |
|--------|-----------------|------------------|
| Again | Resets to 20% of current | Increases |
| Hard | Small increase | Increases slightly |
| Good | Normal increase | Stable |
| Easy | Large increase | Decreases |

**Interval calculation:**
```
Next review (days) = Stability × 9/19
```

A new node starts at ~1 day. After consistent "Good" ratings it grows to 3 → 7 → 14 → 30+ days automatically.

---

## Important Things to Know

### Your API key is safe
- Stored in Postgres `settings` table, never in frontend code or browser storage
- Never transmitted to any service other than `api.anthropic.com` directly from your browser
- Regenerate anytime at **console.anthropic.com** if compromised

### Data never expires
- Neon Postgres free tier: data stored permanently, no inactivity deletion
- Database pauses after 5 min of no activity but wakes in ~1 second
- Data is only lost if you manually delete the Neon project

### Anthropic API costs
| Action | Approximate cost |
|--------|----------------|
| Ingest a 10-page PDF | $0.01–0.03 |
| HyperResearch question | $0.005–0.02 |
| Generate recall question | $0.002–0.005 |
| Typical daily session | < $0.10 |

Monitor usage at **console.anthropic.com/usage**

### Supported file formats
| Format | Notes |
|--------|-------|
| PDF | Sent natively to Claude. Text PDFs work best. |
| DOCX | Converted to text via mammoth before extraction. |
| TXT / MD | Read directly by browser, fastest processing. |

### Per-source chat (Library) is session-only
Chat in the Library page is not saved to the database. For persistent, searchable conversation history use **HyperResearch** instead.

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| "API error 404" | Re-enter your Anthropic key in Settings. Must start with `sk-ant-api03-` |
| "Invalid x-api-key" | You entered a K2/other API key. Go to console.anthropic.com for the correct key |
| "Failed to fetch" | Express server not running. Run `npm run dev:server` in a second terminal |
| Library shows blank screen | Hard reload (`Ctrl+Shift+R`). Check browser console for errors |
| Nodes not appearing after ingest | Check source status in Library. If "failed", verify API key and retry |
| Vercel deploy fails | Add `DATABASE_URL` in Vercel → Settings → Environment Variables → Redeploy |
| DB connection error | Ensure your Neon URL ends with `?sslmode=require` |
| Vite upgraded to v8 | Run: `Remove-Item -Force package-lock.json`, set vite to `^5.4.0` in package.json, then `npm install` |

---

## Available Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite frontend on port 5173 |
| `npm run dev:server` | Start Express backend on port 3001 |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview production build locally |

---

## Version History

| Version | What changed |
|---------|-------------|
| 1.0.0 | Initial release — ingestion, research, recall, graph, analytics |
| 1.1.0 | Switched from localStorage to Postgres (Neon) for permanent storage |
| 1.2.0 | Switched AI from K2-Think-v2 to Anthropic Claude Sonnet 4.5 (no chain-of-thought leakage) |
| 1.3.0 | Added Vercel serverless API — no backend server needed in production |

---

*MemOS v1.3.0 · Built with Claude Sonnet 4.5 · FSRS-4.5 · HyperRAG · Neon Postgres · Vercel*