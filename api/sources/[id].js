import { getPool, initSchema, cors } from '../_lib/db.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  await initSchema()
  const db = getPool()
  const { id } = req.query

  try {
    if (req.method === 'PATCH') {
      const updates = req.body
      const fields = Object.keys(updates)
      if (fields.length === 0) return res.json({ ok: true })
      const setClauses = fields.map((f, i) => `${f}=$${i + 2}`).join(', ')
      const values = fields.map(f =>
        typeof updates[f] === 'object' ? JSON.stringify(updates[f]) : updates[f]
      )
      await db.query(`UPDATE sources SET ${setClauses} WHERE id=$1`, [id, ...values])
      return res.json({ ok: true })
    }

    if (req.method === 'DELETE') {
      await db.query('DELETE FROM sources WHERE id=$1', [id])
      return res.json({ ok: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) { res.status(500).json({ error: e.message }) }
}