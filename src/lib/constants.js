export const CATEGORIES = ['fact','principle','framework','insight','warning','definition','example']

export const CAT_META = {
  fact:       { bg:'#EFF6FF', text:'#1D4ED8', border:'#BFDBFE', icon:'◈', label:'Fact' },
  principle:  { bg:'#F0FDF4', text:'#15803D', border:'#BBF7D0', icon:'◎', label:'Principle' },
  framework:  { bg:'#FDF4FF', text:'#7E22CE', border:'#E9D5FF', icon:'⬡', label:'Framework' },
  insight:    { bg:'#FFFBEB', text:'#B45309', border:'#FDE68A', icon:'✦', label:'Insight' },
  warning:    { bg:'#FFF1F2', text:'#BE123C', border:'#FECDD3', icon:'⚠', label:'Warning' },
  definition: { bg:'#F0F9FF', text:'#0369A1', border:'#BAE6FD', icon:'◷', label:'Definition' },
  example:    { bg:'#F8FAFC', text:'#475569', border:'#CBD5E1', icon:'◌', label:'Example' },
}

export const SOURCE_TYPES = ['book','paper','article','podcast','video','note']

export const SOURCE_ICONS = {
  book: '📚',
  paper: '🔬',
  article: '📰',
  podcast: '🎙️',
  video: '🎬',
  note: '📝',
  url: '🔗',
  pdf: '📄',
  txt: '📃',
  docx: '📝',
  md: '📄',
}

export function daysUntil(iso) {
  return Math.round((new Date(iso) - Date.now()) / 86400000)
}

export function timeAgo(iso) {
  if (!iso) return 'never'
  const s = (Date.now() - new Date(iso)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  if (s < 7 * 86400) return `${Math.floor(s/86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

export function retentionColor(days) {
  if (days <= 0)  return '#EF4444'
  if (days <= 2)  return '#F97316'
  if (days <= 7)  return '#EAB308'
  return '#22C55E'
}

export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB'
  return (bytes/(1024*1024)).toFixed(1) + ' MB'
}

export const EDGE_TYPES = ['SUPPORTS','CONTRADICTS','EXTENDS','REQUIRES','EXAMPLE_OF','DERIVED_FROM','CO_OCCURS_WITH']
export const EDGE_COLORS = {
  SUPPORTS:     '#22C55E',
  CONTRADICTS:  '#EF4444',
  EXTENDS:      '#4A90E2',
  REQUIRES:     '#F97316',
  EXAMPLE_OF:   '#8B5CF6',
  DERIVED_FROM: '#6B7280',
  CO_OCCURS_WITH: '#94A3B8',
}

export const DEMO_EDGES = [
  { from:'n_demo1', to:'n_demo2', type:'SUPPORTS' },
  { from:'n_demo1', to:'n_demo3', type:'EXTENDS' },
  { from:'n_demo3', to:'n_demo2', type:'SUPPORTS' },
  { from:'n_demo4', to:'n_demo2', type:'SUPPORTS' },
  { from:'n_demo4', to:'n_demo1', type:'EXTENDS' },
]
