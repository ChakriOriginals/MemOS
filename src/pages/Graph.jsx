import { useState, useEffect, useRef, useMemo } from 'react'
import useStore from '../store'
import { CAT_META, EDGE_COLORS, DEMO_EDGES, daysUntil } from '../lib/constants'
import { CatTag, Modal, ConfidenceBadge } from '../components/UI'

export default function GraphPage() {
  const { nodes } = useStore(s => ({ nodes: s.nodes }))
  const canvasRef = useRef()
  const [positions, setPositions] = useState({})
  const [dragging, setDragging] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [searchQ, setSearchQ] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const W = 900, H = 520

  // Force-directed layout
  useEffect(() => {
    if (nodes.length === 0) return
    const pos = {}
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.38

    // Group by category for cluster layout
    const byCat = {}
    nodes.forEach(n => { (byCat[n.category] = byCat[n.category] || []).push(n) })
    const cats = Object.keys(byCat)
    cats.forEach((cat, ci) => {
      const catAngle = (ci / cats.length) * Math.PI * 2
      const catCx = cx + r * 0.45 * Math.cos(catAngle)
      const catCy = cy + r * 0.45 * Math.sin(catAngle)
      byCat[cat].forEach((n, i) => {
        const a = (i / byCat[cat].length) * Math.PI * 2 + catAngle
        const nr = r * 0.28 + (Math.random() - 0.5) * 50
        pos[n.id] = {
          x: catCx + nr * Math.cos(a),
          y: catCy + nr * Math.sin(a),
        }
      })
    })
    setPositions(pos)
  }, [nodes.length])

  const filteredNodes = useMemo(() => nodes.filter(n => {
    if (filterCat !== 'all' && n.category !== filterCat) return false
    if (filterSource !== 'all' && n.source_id !== filterSource) return false
    if (searchQ && !n.concept.toLowerCase().includes(searchQ.toLowerCase())) return false
    return true
  }), [nodes, filterCat, filterSource, searchQ])

  const filteredIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes])

  const edges = useMemo(() => DEMO_EDGES.filter(e => filteredIds.has(e.from) && filteredIds.has(e.to)), [filteredIds])

  const nodeRadius = (n) => 14 + (n.fsrs_state?.review_count || 0) * 2.5

  // Mouse events for dragging nodes
  const onNodeMouseDown = (e, id) => {
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    setDragging(id)
    setOffset({
      x: (e.clientX - rect.left) / zoom - pan.x - positions[id]?.x,
      y: (e.clientY - rect.top) / zoom - pan.y - positions[id]?.y,
    })
  }

  // Mouse events for panning canvas
  const onCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.tagName === 'svg') {
      setPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const onMouseMove = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    if (dragging) {
      const mx = (e.clientX - rect.left) / zoom - pan.x
      const my = (e.clientY - rect.top) / zoom - pan.y
      setPositions(p => ({ ...p, [dragging]: { x: mx - offset.x, y: my - offset.y } }))
    } else if (panning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    }
  }

  const onMouseUp = () => { setDragging(null); setPanning(false) }

  const onWheel = (e) => {
    e.preventDefault()
    setZoom(z => Math.max(0.3, Math.min(2.5, z - e.deltaY * 0.001)))
  }

  const usedCats = [...new Set(nodes.map(n => n.category))]
  const sources = useStore(s => s.sources)

  return (
    <div className="fade-up" style={{ padding: '24px 28px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display)' }}>Knowledge Graph</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {filteredNodes.length} nodes · {edges.length} edges · Drag to arrange · Scroll to zoom · Click for detail
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setZoom(1)}>Reset Zoom</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          style={{ width: 200, fontSize: 13 }}
          placeholder="Search nodes…"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        <select
          className="input"
          style={{ width: 140, fontSize: 13 }}
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
        >
          <option value="all">All categories</option>
          {usedCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="input"
          style={{ width: 180, fontSize: 13 }}
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
        >
          <option value="all">All sources</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.title.slice(0, 30)}</option>)}
        </select>

        {/* Edge legend */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {Object.entries(EDGE_COLORS).slice(0, 5).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 14, height: 2, background: color, borderRadius: 1 }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{type.toLowerCase().replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseDown={onCanvasMouseDown}
        onWheel={onWheel}
        style={{
          flex: 1,
          background: 'var(--bg-primary)',
          borderRadius: 18,
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow)',
          overflow: 'hidden',
          cursor: panning ? 'grabbing' : dragging ? 'grabbing' : 'grab',
          position: 'relative',
        }}
      >
        {/* Grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F1F5F9" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Main SVG for edges */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {edges.map((edge, i) => {
              const from = positions[edge.from]
              const to = positions[edge.to]
              if (!from || !to) return null
              const color = EDGE_COLORS[edge.type] || '#CBD5E1'
              const dx = to.x - from.x, dy = to.y - from.y
              const len = Math.sqrt(dx * dx + dy * dy)
              if (len === 0) return null
              const nr = nodeRadius(nodes.find(n => n.id === edge.to) || { fsrs_state: { review_count: 0 } })
              const tx = to.x - dx / len * nr, ty = to.y - dy / len * nr
              const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2
              return (
                <g key={i}>
                  <line x1={from.x} y1={from.y} x2={tx} y2={ty} stroke={color} strokeWidth={1.5} opacity={0.55} />
                  <polygon
                    points={`${tx},${ty} ${tx - 7 * dx / len + 3 * (-dy / len)},${ty - 7 * dy / len + 3 * (dx / len)} ${tx - 7 * dx / len - 3 * (-dy / len)},${ty - 7 * dy / len - 3 * (dx / len)}`}
                    fill={color} opacity={0.7}
                  />
                  <text x={mx} y={my - 4} textAnchor="middle" fontSize={8} fill={color} opacity={0.8} fontFamily="var(--font-mono)">
                    {edge.type}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Nodes */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}>
          {filteredNodes.map(n => {
            const pos = positions[n.id]
            if (!pos) return null
            const r = nodeRadius(n)
            const m = CAT_META[n.category] || CAT_META.fact
            const isHov = hoveredNode === n.id
            const isDue = daysUntil(n.fsrs_state?.next_review_at) <= 0

            return (
              <div
                key={n.id}
                onMouseDown={e => onNodeMouseDown(e, n.id)}
                onMouseEnter={() => setHoveredNode(n.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedNode(n)}
                style={{
                  position: 'absolute',
                  left: pos.x - r,
                  top: pos.y - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: '50%',
                  background: m.bg,
                  border: `2px solid ${isHov ? 'var(--accent)' : m.border}`,
                  cursor: dragging === n.id ? 'grabbing' : 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxShadow: isHov
                    ? '0 0 0 4px rgba(74,144,226,0.2), 0 4px 12px rgba(0,0,0,0.12)'
                    : isDue
                    ? '0 0 0 3px rgba(239,68,68,0.3)'
                    : '0 2px 6px rgba(0,0,0,0.08)',
                  zIndex: isHov ? 10 : 1,
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: r * 0.55, color: m.text, pointerEvents: 'none' }}>{m.icon}</span>

                {/* Tooltip */}
                {isHov && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: 8,
                    background: 'rgba(15,23,42,0.95)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: 10,
                    fontSize: 11,
                    width: 220,
                    whiteSpace: 'normal',
                    lineHeight: 1.5,
                    zIndex: 100,
                    pointerEvents: 'none',
                    boxShadow: 'var(--shadow-lg)',
                  }}>
                    <div style={{ fontSize: 10, color: m.bg, fontWeight: 700, marginBottom: 4 }}>{m.label.toUpperCase()}</div>
                    <div>{n.concept.slice(0, 100)}…</div>
                    <div style={{ color: '#94A3B8', marginTop: 5, fontSize: 10 }}>{n.source_ref?.title}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⬡</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Your knowledge graph is empty</div>
            <div style={{ fontSize: 13 }}>Ingest documents to see your knowledge map grow</div>
          </div>
        )}
      </div>

      {/* Node detail modal */}
      <Modal open={!!selectedNode} onClose={() => setSelectedNode(null)} width={540}>
        {selectedNode && <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
      </Modal>
    </div>
  )
}

function NodeDetailPanel({ node, onClose }) {
  const d = daysUntil(node.fsrs_state?.next_review_at)
  const m = CAT_META[node.category] || CAT_META.fact

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <CatTag category={node.category} size="md" />
        <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }}>×</button>
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: 14 }}>
        {node.concept}
      </h3>

      {node.applications && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: '#15803D', fontWeight: 700, marginBottom: 4 }}>APPLICATION</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{node.applications}</div>
        </div>
      )}

      {node.source_quote && (
        <div style={{ background: 'var(--bg-secondary)', borderLeft: '3px solid var(--accent)', borderRadius: '0 8px 8px 0', padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6 }}>
            "{node.source_quote}"
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            — {node.source_ref?.title}, {node.source_ref?.author}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Confidence', value: `${Math.round(node.confidence * 100)}%` },
          { label: 'Reviews', value: node.fsrs_state?.review_count || 0 },
          { label: 'Next Review', value: d <= 0 ? 'NOW ⚡' : d === 1 ? 'Tomorrow' : `${d} days` },
          { label: 'Stability', value: (node.fsrs_state?.stability || 1).toFixed(1) },
          { label: 'Difficulty', value: `${Math.round((node.fsrs_state?.difficulty || 0.3) * 100)}%` },
          { label: 'Interval', value: `${node.fsrs_state?.interval_days || 1}d` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {node.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {node.tags.map(t => (
            <span key={t} style={{ fontSize: 11, padding: '3px 9px', background: 'var(--accent-light)', color: 'var(--accent-dark)', borderRadius: 20 }}>
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
