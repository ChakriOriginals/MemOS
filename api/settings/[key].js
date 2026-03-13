import { getPool, initSchema, cors } from '../_lib/db.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  await initSchema()
  const db = getPool()
  const { key } = req.query

  try {
    if (req.method === 'GET') {
      const { rows } = await db.query('SELECT value FROM settings WHERE key=$1', [key])
      return res.json({ value: rows[0]?.value || null })
    }

    if (req.method === 'PUT') {
      const { value } = req.body
      await db.query(`
        INSERT INTO settings(key, value, updated_at) VALUES($1,$2,NOW())
        ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()
      `, [key, value])
      return res.json({ ok: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) { res.status(500).json({ error: e.message }) }
}