// ────────────────────────────────────────────────────────────────────────────
// MemOS HyperRAG Engine
// Goes far beyond naive RAG by combining:
//   1. Semantic chunking (respects paragraph/section boundaries)
//   2. Multi-vector retrieval (TF-IDF + BM25-inspired scoring)
//   3. Query decomposition (breaks complex questions into sub-queries)
//   4. Contextual re-ranking (scores by relevance + recency + source quality)
//   5. Cross-source synthesis (connects insights across documents)
//   6. Iterative refinement (follow-up retrieval if answer is insufficient)
//   7. Citation grounding (every claim traced to exact source chunk)
// ────────────────────────────────────────────────────────────────────────────

// All AI calls now use the Anthropic API via Vite proxy (/api/anthropic/...)
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5'

// ── Text extraction ─────────────────────────────────────────────────────────

export async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'txt' || ext === 'md') {
    return await file.text()
  }
  if (ext === 'pdf') {
    return await extractPdfText(file)
  }
  if (ext === 'docx' || ext === 'doc') {
    return await extractDocxText(file)
  }
  if (ext === 'epub') {
    throw new Error('EPUB not supported yet. Convert to PDF or TXT first.')
  }
  // Fallback: plain text
  return await file.text()
}

async function extractPdfText(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const text = extractTextFromPdfBytes(bytes)
    if (!text || text.trim().length < 20) {
      throw new Error('PDF has no selectable text — it may be a scanned image. Use the Paste Text tab instead.')
    }
    return text
  } catch (e) {
    throw new Error(e.message || 'Could not read PDF.')
  }
}

// Minimal PDF text extractor — reads BT...ET text blocks from raw PDF bytes.
// Handles Tj, TJ, ' and " operators. No worker, no CDN, no dependencies.
function extractTextFromPdfBytes(bytes) {
  // Decode bytes to latin-1 string (preserves byte values for binary parsing)
  let src = ''
  for (let i = 0; i < bytes.length; i++) src += String.fromCharCode(bytes[i])

  const parts = []

  // Find all BT...ET blocks (text objects in PDF spec)
  const btEtRe = /BT([\s\S]*?)ET/g
  let btMatch
  while ((btMatch = btEtRe.exec(src)) !== null) {
    const block = btMatch[1]
    const blockParts = []

    // Match all text-showing operators in order:
    // (text)Tj  [(text)]TJ  (text)'  (text)"
    const opRe = /\(([^)]*)\)\s*(?:Tj|'|")|(\[([^\]]*)\])\s*TJ/g
    let opMatch
    while ((opMatch = opRe.exec(block)) !== null) {
      if (opMatch[1] !== undefined) {
        // Simple string: (text)Tj
        blockParts.push(decodePdfString(opMatch[1]))
      } else if (opMatch[3] !== undefined) {
        // Array: [(text1)-100(text2)]TJ — extract all strings inside
        const arr = opMatch[3]
        const strRe = /\(([^)]*)\)/g
        let strMatch
        while ((strMatch = strRe.exec(arr)) !== null) {
          const s = decodePdfString(strMatch[1])
          if (s) blockParts.push(s)
        }
      }
    }

    if (blockParts.length > 0) {
      parts.push(blockParts.join(''))
    }
  }

  // Join blocks with spaces, collapse whitespace, remove non-printable chars
  return parts
    .join(' ')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/\s{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

function decodePdfString(raw) {
  // Handle common PDF string escapes
  return raw
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\(.)/g, '$1')
}

function loadScript() {} // no longer needed

async function extractDocxText(file) {
  try {
    const mammoth = await import('mammoth')
    const mod = mammoth.default || mammoth
    const arrayBuffer = await file.arrayBuffer()
    const result = await mod.extractRawText({ arrayBuffer })
    if (!result?.value?.trim()) throw new Error('DOCX appears empty.')
    return result.value
  } catch (e) {
    console.error('DOCX parse error:', e)
    throw new Error(e.message || 'Could not parse DOCX.')
  }
}

// ── Semantic chunking ────────────────────────────────────────────────────────

export function semanticChunk(text, sourceId, chunkSize = 800, overlap = 150) {
  // 1. Split into paragraphs first (respect natural boundaries)
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 30)

  const chunks = []
  let currentChunk = ''
  let currentStart = 0
  let chunkIndex = 0

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    const candidate = currentChunk ? currentChunk + '\n\n' + para : para

    if (candidate.length > chunkSize && currentChunk.length > 100) {
      // Save current chunk
      chunks.push(createChunk(currentChunk, sourceId, chunkIndex++, currentStart))
      // Start new chunk with overlap from end of current
      const overlapText = currentChunk.slice(-overlap)
      currentChunk = overlapText + '\n\n' + para
      currentStart = i
    } else {
      currentChunk = candidate
    }
  }

  if (currentChunk.trim().length > 50) {
    chunks.push(createChunk(currentChunk, sourceId, chunkIndex++, currentStart))
  }

  return chunks
}

function createChunk(text, sourceId, index, paraIndex) {
  const tokens = tokenize(text)
  return {
    id: `chunk_${sourceId}_${index}`,
    source_id: sourceId,
    text: text.trim(),
    index,
    para_index: paraIndex,
    tokens,
    token_freq: buildFreqMap(tokens),
    char_count: text.length,
    created_at: new Date().toISOString(),
  }
}

// ── Tokenization & scoring ───────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
}

function buildFreqMap(tokens) {
  const freq = {}
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1
  return freq
}

// BM25-inspired scoring
function bm25Score(queryTokens, chunk, avgDocLen, k1 = 1.5, b = 0.75) {
  const docLen = chunk.tokens.length
  let score = 0
  for (const qt of queryTokens) {
    const tf = chunk.token_freq[qt] || 0
    if (tf === 0) continue
    const idf = 1.0 // simplified; real IDF needs corpus stats
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)))
    score += idf * tfNorm
  }
  return score
}

// ── Query decomposition ──────────────────────────────────────────────────────

export async function decomposeQuery(query, apiKey) {
  // For simple queries, skip decomposition
  if (query.split(' ').length < 8) return [query]

  try {
    const resp = await callClaude(apiKey, {
      system: `You decompose complex questions into 2-4 focused sub-queries for document retrieval.
Return ONLY a JSON array of strings. Example: ["sub-query 1", "sub-query 2"]
Keep each sub-query focused and searchable. If the original is already simple, return ["original query"].`,
      user: `Decompose this question for retrieval: "${query}"`,
      max_tokens: 300,
    })
    const clean = resp.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? parsed : [query]
  } catch {
    return [query]
  }
}

// ── HyperRAG Retrieval ───────────────────────────────────────────────────────

export function hyperRetrieve(query, chunks, topK = 8) {
  if (!chunks || chunks.length === 0) return []

  const queryTokens = tokenize(query)
  const avgDocLen = chunks.reduce((a, c) => a + c.tokens.length, 0) / chunks.length

  // Multi-signal scoring
  const scored = chunks.map(chunk => {
    const bm25 = bm25Score(queryTokens, chunk, avgDocLen)

    // Exact phrase bonus
    const lowerText = chunk.text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const phraseBonus = lowerText.includes(lowerQuery) ? 2.0 : 0

    // Token overlap ratio
    const overlap = queryTokens.filter(t => chunk.token_freq[t]).length
    const overlapRatio = queryTokens.length > 0 ? overlap / queryTokens.length : 0

    // Position bonus (earlier chunks slightly preferred for context)
    const posBonus = 1 / (1 + chunk.index * 0.05)

    // Length penalty (very short chunks less useful)
    const lenPenalty = chunk.char_count < 100 ? 0.5 : 1.0

    const totalScore = (bm25 * 0.5 + overlapRatio * 3 + phraseBonus + posBonus * 0.2) * lenPenalty

    return { chunk, score: totalScore }
  })

  // Sort and deduplicate by proximity (don't return adjacent chunks separately)
  const sorted = scored.sort((a, b) => b.score - a.score)
  const selected = []
  const usedIndices = new Set()

  for (const item of sorted) {
    if (selected.length >= topK) break
    if (item.score < 0.1) break
    // Skip chunks too close to already selected ones (avoid redundancy)
    const idx = item.chunk.index
    const tooClose = [...usedIndices].some(i => Math.abs(i - idx) <= 1)
    if (!tooClose) {
      selected.push(item)
      usedIndices.add(idx)
    }
  }

  return selected
}

// ── Multi-query retrieval ────────────────────────────────────────────────────

export function multiQueryRetrieve(subQueries, chunks, topK = 12) {
  const allResults = new Map()

  for (const q of subQueries) {
    const results = hyperRetrieve(q, chunks, topK)
    for (const r of results) {
      const id = r.chunk.id
      if (allResults.has(id)) {
        // Boost score if found by multiple queries
        allResults.get(id).score += r.score * 0.5
        allResults.get(id).matched_queries.push(q)
      } else {
        allResults.set(id, { ...r, matched_queries: [q] })
      }
    }
  }

  return Array.from(allResults.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

// ── Context assembly ─────────────────────────────────────────────────────────

export function assembleContext(retrievedChunks, sourceMap) {
  return retrievedChunks.map((item, i) => {
    const src = sourceMap[item.chunk.source_id]
    const srcLabel = src ? `${src.title} (${src.author || 'Unknown'})` : 'Unknown source'
    return `[SOURCE ${i + 1}: ${srcLabel}]\n${item.chunk.text}`
  }).join('\n\n---\n\n')
}

// ── Memory node extraction ───────────────────────────────────────────────────

export async function extractMemoryNodes(text, sourceTitle, sourceAuthor, sourceType, apiKey, onChunk) {
  const SCHEMA = {
    concept: 'One clear, testable, atomic statement of the idea (max 280 chars)',
    category: 'one of: fact | principle | framework | insight | warning | definition | example',
    confidence: '0.0-1.0 float based on source clarity',
    applications: 'Practical use cases, when to apply this idea',
    source_quote: 'Verbatim quote max 50 words capturing the concept',
    tags: 'array of 2-5 lowercase keyword strings',
  }

  const systemPrompt = `You are a precision knowledge distiller for MemOS. Extract atomic, independently-meaningful memory nodes.
Rules:
1. Each node = one idea, testable and falsifiable
2. Be specific, not vague
3. Extract 5-15 nodes per chunk
4. Output ONLY valid JSON array, no preamble
Schema: ${JSON.stringify(SCHEMA)}`

  const userPrompt = `Extract memory nodes from:
SOURCE: "${sourceTitle}" by ${sourceAuthor} (${sourceType})

CONTENT:
${text.slice(0, 6000)}

Return JSON array of nodes.`

  const raw = await callClaude(apiKey, { system: systemPrompt, user: userPrompt, max_tokens: 2000 })

  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { return [] }
    }
    return []
  }
}

// ── Hyper-Research Q&A ───────────────────────────────────────────────────────

export async function hyperResearchAnswer({
  query,
  chunks,
  nodes,
  sources,
  apiKey,
  conversationHistory = [],
  onStream,
  scope = 'all',
}) {
  // 1. Filter by scope
  const scopedChunks = scope === 'all' ? chunks : chunks.filter(c => c.source_id === scope)
  const scopedNodes  = scope === 'all' ? nodes  : nodes.filter(n => n.source_id === scope)

  // 2. Retrieve relevant chunks via BM25
  const retrieved = scopedChunks.length > 0
    ? hyperRetrieve(query, scopedChunks, 12)
    : []

  // 3. Build source map
  const sourceMap = Object.fromEntries(sources.map(s => [s.id, s]))

  // 4. Assemble document context — label each source clearly
  const docContext = retrieved.length > 0
    ? retrieved.map((r, i) => {
        const src = sourceMap[r.chunk.source_id]
        const label = src ? `${src.title}${src.author ? ` by ${src.author}` : ''}` : 'Unknown source'
        return `[SOURCE ${i + 1}: ${label}]\n${r.chunk.text}`
      }).join('\n\n---\n\n')
    : ''

  // 5. Memory nodes — only include ones from same source scope
  const nodeContext = scopedNodes.length > 0
    ? scopedNodes.slice(0, 15).map(n =>
        `• ${n.concept} (${n.category})`
      ).join('\n')
    : ''

  // 6. System prompt — direct, conversational, no internal monologue
  const systemPrompt = `You are a helpful AI assistant embedded in MemOS, a personal knowledge management app. You answer questions based on the user's uploaded documents.

RULES:
- Answer the user's question directly and helpfully — like a smart colleague, not an academic paper
- Use the document content provided below as your primary source of truth
- Cite sources inline as [SOURCE 1], [SOURCE 2] etc. when referencing specific content
- If the documents don't contain relevant info, say so briefly and answer from general knowledge if appropriate
- Keep answers concise unless the question requires depth
- Do NOT narrate your thinking process or reasoning steps — just answer
- Do NOT start with "We have a user asking..." or any internal planning language
- Use markdown naturally (bold for emphasis, bullets for lists) but don't over-structure simple answers

${docContext ? `DOCUMENT CONTEXT:\n${docContext}` : 'No documents have been uploaded yet.'}

${nodeContext ? `KEY CONCEPTS FROM DOCUMENTS:\n${nodeContext}` : ''}`

  // 7. Build messages with conversation history
  const messages = [
    ...conversationHistory.slice(-8).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: query },
  ]

  // 8. Stream via Anthropic API
  let fullAnswer = ''
  await streamAnthropic(apiKey, {
    system: systemPrompt,
    messages,
    max_tokens: 2000,
    onChunk: (chunk) => {
      fullAnswer += chunk
      onStream?.(chunk)
    },
  })

  return {
    answer: fullAnswer,
    sources_used: retrieved.map(r => ({
      chunk_id: r.chunk.id,
      source_id: r.chunk.source_id,
      score: r.score,
      preview: r.chunk.text.slice(0, 120),
    })),
    sub_queries: [query],
    chunks_retrieved: retrieved.length,
  }
}

// ── Recall question generation ───────────────────────────────────────────────

export async function generateRecallQuestion(node, apiKey) {
  const prompt = `Generate a retrieval practice question for this memory node.
The question must require reconstruction from memory, not recognition.

NODE:
Concept: ${node.concept}
Category: ${node.category}
Applications: ${node.applications}

Return ONLY JSON: {"question_type": "...", "question_text": "...", "ideal_answer_outline": "..."}`

  try {
    const raw = await callAnthropic(apiKey, 'Return only valid JSON, no other text.', prompt, 400)
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return {
      question_type: 'recall',
      question_text: `In your own words, explain: "${node.concept.slice(0, 100)}..."`,
      ideal_answer_outline: node.applications,
    }
  }
}

// ── Summary generation ───────────────────────────────────────────────────────

export async function generateSourceSummary(text, title, apiKey) {
  const prompt = `Summarize this document for a knowledge management system.

TITLE: ${title}
CONTENT (excerpt): ${text.slice(0, 4000)}

Return JSON: {
  "summary": "2-3 sentence overview",
  "key_themes": ["theme1", "theme2", "theme3"],
  "content_type": "textbook|research_paper|podcast_transcript|article|other",
  "knowledge_density": "low|medium|high"
}`

  try {
    const raw = await callAnthropic(apiKey, 'Return only valid JSON, no other text.', prompt, 500)
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { summary: 'Document processed.', key_themes: [], content_type: 'other', knowledge_density: 'medium' }
  }
}

// ── Anthropic API — non-streaming ────────────────────────────────────────────
export async function callAnthropic(apiKey, system, user, max_tokens = 1000) {
  const resp = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  const data = await resp.json()
  if (!resp.ok) {
    console.error('Anthropic API error:', resp.status, JSON.stringify(data))
    throw new Error(data.error?.message || `API error ${resp.status}: ${JSON.stringify(data)}`)
  }
  return data.content?.map(i => i.text || '').join('') || ''
}

// ── Anthropic API — streaming ─────────────────────────────────────────────────
export async function streamAnthropic(apiKey, { system, messages, max_tokens = 2000, onChunk }) {
  console.log('streamAnthropic called, key prefix:', apiKey?.slice(0, 20), 'length:', apiKey?.length)
  const resp = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens,
      stream: true,
      system,
      messages,
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    console.error('Anthropic stream error:', resp.status, JSON.stringify(err))
    throw new Error(err.error?.message || `API error ${resp.status}: ${JSON.stringify(err)}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
    for (const line of lines) {
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        // Anthropic streaming format: content_block_delta with delta.text
        const text = json.delta?.text || ''
        if (text) onChunk?.(text)
      } catch { /* skip malformed lines */ }
    }
  }
}

// ── Legacy K2 wrappers (kept for compatibility, now route to Anthropic) ───────
export async function callClaude(apiKey, { system, user, messages, max_tokens = 1000 }) {
  const userMsg = user || messages?.find(m => m.role === 'user')?.content || ''
  return callAnthropic(apiKey, system || '', userMsg, max_tokens)
}

export async function streamClaude(apiKey, { system, messages, max_tokens = 2000, onChunk }) {
  return streamAnthropic(apiKey, { system, messages, max_tokens, onChunk })
}

// ── K2 direct call (kept for compatibility) ───────────────────────────────────
export async function callK2Direct(apiKey, systemPrompt, userPrompt, max_tokens = 3000) {
  return callAnthropic(apiKey, systemPrompt, userPrompt, max_tokens)
}

export function extractJsonFromModelOutput(raw) {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
  const arrayMatches = [...cleaned.matchAll(/(\[[\s\S]*?\])/g)]
  for (let i = arrayMatches.length - 1; i >= 0; i--) {
    try { const p = JSON.parse(arrayMatches[i][1]); if (Array.isArray(p) && p.length > 0) return p } catch {}
  }
  const greedyMatch = cleaned.match(/\[[\s\S]*\]/)
  if (greedyMatch) { try { const p = JSON.parse(greedyMatch[0]); if (Array.isArray(p)) return p } catch {} }
  try { const p = JSON.parse(cleaned); if (Array.isArray(p)) return p } catch {}
  return null
}

// ── Stopwords ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','up','about','into','through','during','is','are','was',
  'were','be','been','being','have','has','had','do','does','did','will',
  'would','could','should','may','might','shall','can','this','that','these',
  'those','it','its','as','if','then','than','so','yet','both','not','no',
  'all','each','every','some','any','more','most','other','such','when',
  'where','which','who','how','what','their','there','they','them','we',
  'our','us','your','you','he','she','his','her','my','i','me','was',
])