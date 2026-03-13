import { getPool, initSchema, cors } from '../_lib/db.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  await initSchema()
  const db = getPool()

  try {
    if (req.method === 'POST') {
      const { source_id, chunks } = req.body
      await db.query('DELETE FROM chunks WHERE source_id=$1', [source_id])

      if (chunks?.length > 0) {
        const values = chunks.map((_, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',')
        const params = chunks.flatMap((c, i) => [c.id, source_id, c.text, i])
        await db.query(`INSERT INTO chunks(id, source_id, text, chunk_index) VALUES ${values}`, params)
      }
      return res.json({ ok: true, count: chunks?.length || 0 })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) { res.status(500).json({ error: e.message }) }
}