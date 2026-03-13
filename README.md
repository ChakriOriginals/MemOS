# MemOS — Deployment Guide

## Architecture
```
React (Vite) ──► Express (Node) ──► PostgreSQL
  Render Static    Render Web        Render DB (free)
```

---

## Deploy to Render (free, permanent storage)

### Step 1 — Push code to GitHub
```bash
git init
git add .
git commit -m "MemOS with Postgres backend"
git remote add origin https://github.com/YOUR_USERNAME/memos.git
git push -u origin main
```

### Step 2 — Create Render account
Go to https://render.com and sign up (free).

### Step 3 — Deploy with render.yaml (one click)
1. In Render dashboard → click **New** → **Blueprint**
2. Connect your GitHub repo
3. Render reads `render.yaml` automatically and creates:
   - A **Web Service** (Express + React frontend)
   - A **PostgreSQL database** (free, permanent)
4. Click **Apply** — deploy takes ~3 minutes

### Step 4 — Update FRONTEND_URL in render.yaml
After deploy, Render gives you a URL like `https://memos-app.onrender.com`.
Update `render.yaml` line:
```yaml
value: https://memos-app.onrender.com   # ← your actual URL
```
Commit and push — Render auto-redeploys.

### Step 5 — Open the app
Visit your Render URL, enter your Anthropic API key, done! 🎉

---

## Run locally

### Prerequisites
- Node 18+
- PostgreSQL running locally (or use a free [Neon](https://neon.tech) connection string)

### Setup
```bash
# 1. Install frontend deps
npm install

# 2. Install server deps
cd server && npm install && cd ..

# 3. Configure server env
cp server/.env.example server/.env
# Edit server/.env and set DATABASE_URL to your Postgres connection string

# 4. Start both servers (two terminals)
npm run dev           # Terminal 1: Vite on port 5173
npm run dev:server    # Terminal 2: Express on port 3001
```

Visit http://localhost:5173

---

## Free Postgres without installing anything locally
Use [Neon](https://neon.tech) — free Postgres in the cloud, no credit card:
1. Sign up at neon.tech
2. Create a project → copy the connection string
3. Paste it as `DATABASE_URL` in `server/.env`
4. Run `npm run dev:server` — schema creates automatically

---

## Data persistence
- All sources, chunks, nodes, and chat history live in Postgres
- Data survives browser clears, device switches, and redeploys
- Free Render Postgres: 1 GB storage, never expires