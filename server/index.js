
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// ── Database ──────────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// Run schema on startup
async function initDB() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
    await pool.query(schema)
    console.log('✓ Database schema ready')
  } catch (err) {
    console.error('✗ DB init error:', err.message)
    process.exit(1)
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '50mb' }))

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true }))

// ── Settings (API key stored server-side, encrypted by user) ─────────────────
app.get('/api/settings/:key', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT value FROM settings WHERE key=$1', [req.params.key])
    res.json({ value: rows[0]?.value || null })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.put('/api/settings/:key', async (req, res) => {
  try {
    const { value } = req.body
    await pool.query(`
      INSERT INTO settings(key, value, updated_at) VALUES($1,$2,NOW())
      ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()
    `, [req.params.key, value])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Sources ───────────────────────────────────────────────────────────────────
app.get('/api/sources', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sources ORDER BY created_at DESC')
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/sources', async (req, res) => {
  try {
    const { id, title, author, type, size_label, status, metadata } = req.body
    const { rows } = await pool.query(`
      INSERT INTO sources(id, title, author, type, size_label, status, metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(id) DO UPDATE SET title=$2, status=$6, metadata=$7
      RETURNING *
    `, [id, title, author||'', type||'pdf', size_label||'', status||'pending', JSON.stringify(metadata||{})])
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/sources/:id', async (req, res) => {
  try {
    const updates = req.body
    const fields = Object.keys(updates)
    if (fields.length === 0) return res.json({ ok: true })
    
    const setClauses = fields.map((f, i) => `${f}=$${i + 2}`).join(', ')
    const values = fields.map(f => 
      typeof updates[f] === 'object' ? JSON.stringify(updates[f]) : updates[f]
    )
    
    await pool.query(
      `UPDATE sources SET ${setClauses} WHERE id=$1`,
      [req.params.id, ...values]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/sources/:id', async (req, res) => {
  try {
    // Cascade deletes chunks and nodes via FK constraint
    await pool.query('DELETE FROM sources WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Chunks ────────────────────────────────────────────────────────────────────
app.get('/api/chunks', async (req, res) => {
  try {
    const { source_id } = req.query
    const query = source_id
      ? 'SELECT * FROM chunks WHERE source_id=$1 ORDER BY chunk_index'
      : 'SELECT * FROM chunks ORDER BY chunk_index'
    const { rows } = await pool.query(query, source_id ? [source_id] : [])
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/chunks/bulk', async (req, res) => {
  try {
    const { source_id, chunks } = req.body
    // Delete existing chunks for this source then insert new
    await pool.query('DELETE FROM chunks WHERE source_id=$1', [source_id])
    
    if (chunks.length > 0) {
      const values = chunks.map((c, i) => 
        `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`
      ).join(',')
      const params = chunks.flatMap((c, i) => [c.id, source_id, c.text, i])
      await pool.query(
        `INSERT INTO chunks(id, source_id, text, chunk_index) VALUES ${values}`,
        params
      )
    }
    res.json({ ok: true, count: chunks.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Nodes ─────────────────────────────────────────────────────────────────────
app.get('/api/nodes', async (req, res) => {
  try {
    const { source_id } = req.query
    const query = source_id
      ? 'SELECT * FROM nodes WHERE source_id=$1 ORDER BY created_at DESC'
      : 'SELECT * FROM nodes ORDER BY created_at DESC'
    const { rows } = await pool.query(query, source_id ? [source_id] : [])
    // Parse JSONB fields
    res.json(rows.map(r => ({
      ...r,
      source_ref: r.source_ref || {},
      tags: r.tags || [],
      fsrs_state: r.fsrs_state || {},
    })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/nodes/bulk', async (req, res) => {
  try {
    const { nodes } = req.body
    if (!nodes?.length) return res.json({ ok: true, count: 0 })

    for (const n of nodes) {
      await pool.query(`
        INSERT INTO nodes(id, source_id, concept, category, confidence, applications, source_quote, source_ref, tags, fsrs_state, created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT(id) DO UPDATE SET
          concept=$3, category=$4, confidence=$5,
          applications=$6, source_quote=$7, source_ref=$8, tags=$9, fsrs_state=$10
      `, [
        n.id, n.source_id, n.concept, n.category,
        n.confidence, n.applications, n.source_quote||'',
        JSON.stringify(n.source_ref||{}),
        JSON.stringify(n.tags||[]),
        JSON.stringify(n.fsrs_state||{}),
        n.created_at || new Date().toISOString(),
      ])
    }
    res.json({ ok: true, count: nodes.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/nodes/:id', async (req, res) => {
  try {
    const { fsrs_state, concept, category, confidence, applications, tags } = req.body
    const updates = {}
    if (fsrs_state !== undefined) updates.fsrs_state = JSON.stringify(fsrs_state)
    if (concept !== undefined) updates.concept = concept
    if (category !== undefined) updates.category = category
    if (confidence !== undefined) updates.confidence = confidence
    if (applications !== undefined) updates.applications = applications
    if (tags !== undefined) updates.tags = JSON.stringify(tags)

    const fields = Object.keys(updates)
    if (!fields.length) return res.json({ ok: true })

    const setClauses = fields.map((f, i) => `${f}=$${i + 2}`).join(', ')
    await pool.query(
      `UPDATE nodes SET ${setClauses} WHERE id=$1`,
      [req.params.id, ...Object.values(updates)]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/nodes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM nodes WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Research Chat ─────────────────────────────────────────────────────────────
app.get('/api/chat', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM research_chat ORDER BY created_at ASC LIMIT 200'
    )
    res.json(rows.map(r => ({ ...r, meta: r.meta || {} })))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/chat', async (req, res) => {
  try {
    const { id, role, content, meta, error } = req.body
    const { rows } = await pool.query(`
      INSERT INTO research_chat(id, role, content, meta, error)
      VALUES($1,$2,$3,$4,$5) RETURNING *
    `, [id, role, content, JSON.stringify(meta||{}), error||false])
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/chat', async (req, res) => {
  try {
    await pool.query('DELETE FROM research_chat')
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Catch-all: serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  })
}

// ── Start ─────────────────────────────────────────────────────────────────────
await initDB()
app.listen(PORT, () => console.log(`✓ MemOS server running on port ${PORT}`))