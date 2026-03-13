// All calls to the MemOS Express/Postgres backend
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `API error ${res.status}`)
  }
  return res.json()
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSetting  = (key)        => req('GET',  `/api/settings/${key}`)
export const setSetting  = (key, value) => req('PUT',  `/api/settings/${key}`, { value })

// ── Sources ───────────────────────────────────────────────────────────────────
export const getSources    = ()          => req('GET',    '/api/sources')
export const createSource  = (src)       => req('POST',   '/api/sources', src)
export const updateSource  = (id, patch) => req('PATCH',  `/api/sources/${id}`, patch)
export const deleteSource  = (id)        => req('DELETE', `/api/sources/${id}`)

// ── Chunks ────────────────────────────────────────────────────────────────────
export const getChunks   = (sourceId)           => req('GET',  `/api/chunks${sourceId ? `?source_id=${sourceId}` : ''}`)
export const saveChunks  = (source_id, chunks)  => req('POST', '/api/chunks/bulk', { source_id, chunks })

// ── Nodes ─────────────────────────────────────────────────────────────────────
export const getNodes    = (sourceId)   => req('GET',    `/api/nodes${sourceId ? `?source_id=${sourceId}` : ''}`)
export const saveNodes   = (nodes)      => req('POST',   '/api/nodes/bulk', { nodes })
export const updateNode  = (id, patch)  => req('PATCH',  `/api/nodes/${id}`, patch)
export const deleteNode  = (id)         => req('DELETE', `/api/nodes/${id}`)

// ── Research Chat ─────────────────────────────────────────────────────────────
export const getChat     = ()    => req('GET',    '/api/chat')
export const postMessage = (msg) => req('POST',   '/api/chat', msg)
export const clearChat   = ()    => req('DELETE', '/api/chat')