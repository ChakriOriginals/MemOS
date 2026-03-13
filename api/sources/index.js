import { getPool, initSchema, cors } from '../_lib/db.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  await initSchema()
  const db = getPool()

  try {
    if (req.method === 'GET') {
      const { rows } = await db.query('SELECT * FROM sources ORDER BY created_at DESC')
      return res.json(rows)
    }

    if (req.method === 'POST') {
      const { id, title, author, type, size_label, status, metadata } = req.body
      const { rows } = await db.query(`
        INSERT INTO sources(id, title, author, type, size_label, status, metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(id) DO UPDATE SET title=$2, status=$6, metadata=$7
        RETURNING *
      `, [id, title, author||'', type||'pdf', size_label||'', status||'pending', JSON.stringify(metadata||{})])
      return res.json(rows[0])
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) { res.status(500).json({ error: e.message }) }
}