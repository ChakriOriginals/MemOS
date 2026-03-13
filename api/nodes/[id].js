import { getPool, initSchema, cors } from '../_lib/db.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  await initSchema()
  const db = getPool()
  const { id } = req.query

  try {
    if (req.method === 'PATCH') {
      const { fsrs_state, concept, category, confidence, applications, tags } = req.body
      const updates = {}
      if (fsrs_state   !== undefined) updates.fsrs_state   = JSON.stringify(fsrs_state)
      if (concept      !== undefined) updates.concept      = concept
      if (category     !== undefined) updates.category     = category
      if (confidence   !== undefined) updates.confidence   = confidence
      if (applications !== undefined) updates.applications = applications
      if (tags         !== undefined) updates.tags         = JSON.stringify(tags)

      const fields = Object.keys(updates)
      if (!fields.length) return res.json({ ok: true })
      const setClauses = fields.map((f, i) => `${f}=$${i + 2}`).join(', ')
      await db.query(`UPDATE nodes SET ${setClauses} WHERE id=$1`, [id, ...Object.values(updates)])
      return res.json({ ok: true })
    }

    if (req.method === 'DELETE') {
      await db.query('DELETE FROM nodes WHERE id=$1', [id])
      return res.json({ ok: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) { res.status(500).json({ error: e.message }) }
}