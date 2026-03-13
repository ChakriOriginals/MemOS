import { getPool, initSchema, cors } from './_lib/db.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  try {
    await initSchema()
    res.json({ ok: true, message: 'MemOS API running' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}