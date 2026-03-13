import { getPool, initSchema, cors } from '../_lib/db.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  await initSchema()
  const db = getPool()

  try {
    if (req.method === 'GET') {
      const { rows } = await db.query(
        'SELECT * FROM research_chat ORDER BY created_at ASC LIMIT 200'
      )
      return res.json(rows.map(r => ({ ...r, meta: r.meta || {} })))
    }

    if (req.method === 'POST') {
      const { id, role, content, meta, error } = req.body
      const { rows } = await db.query(`
        INSERT INTO research_chat(id, role, content, meta, error)
        VALUES($1,$2,$3,$4,$5) RETURNING *
      `, [id, role, content, JSON.stringify(meta||{}), error||false])
      return res.json(rows[0])
    }

    if (req.method === 'DELETE') {
      await db.query('DELETE FROM research_chat')
      return res.json({ ok: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) { res.status(500).json({ error: e.message }) }
}