import { getPool, initSchema, cors } from '../_lib/db.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  await initSchema()
  const db = getPool()

  try {
    if (req.method === 'GET') {
      const { source_id } = req.query
      const query = source_id
        ? 'SELECT * FROM chunks WHERE source_id=$1 ORDER BY chunk_index'
        : 'SELECT * FROM chunks ORDER BY chunk_index'
      const { rows } = await db.query(query, source_id ? [source_id] : [])
      return res.json(rows)
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) { res.status(500).json({ error: e.message }) }
}