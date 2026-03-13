import { getPool, initSchema, cors } from '../_lib/db.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  await initSchema()
  const db = getPool()

  try {
    if (req.method === 'GET') {
      const { source_id } = req.query
      const query = source_id
        ? 'SELECT * FROM nodes WHERE source_id=$1 ORDER BY created_at DESC'
        : 'SELECT * FROM nodes ORDER BY created_at DESC'
      const { rows } = await db.query(query, source_id ? [source_id] : [])
      return res.json(rows.map(r => ({
        ...r,
        source_ref: r.source_ref || {},
        tags: r.tags || [],
        fsrs_state: r.fsrs_state || {},
      })))
    }

    if (req.method === 'POST') {
      const { nodes } = req.body
      if (!nodes?.length) return res.json({ ok: true, count: 0 })
      for (const n of nodes) {
        await db.query(`
          INSERT INTO nodes(id, source_id, concept, category, confidence, applications, source_quote, source_ref, tags, fsrs_state, created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT(id) DO UPDATE SET
            concept=$3, category=$4, confidence=$5,
            applications=$6, source_quote=$7, source_ref=$8, tags=$9, fsrs_state=$10
        `, [
          n.id, n.source_id, n.concept, n.category,
          n.confidence, n.applications, n.source_quote||'',
          JSON.stringify(n.source_ref||{}), JSON.stringify(n.tags||[]),
          JSON.stringify(n.fsrs_state||{}),
          n.created_at || new Date().toISOString(),
        ])
      }
      return res.json({ ok: true, count: nodes.length })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) { res.status(500).json({ error: e.message }) }
}