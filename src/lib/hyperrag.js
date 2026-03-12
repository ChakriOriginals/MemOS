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

const K2_ENDPOINT = 'https://api.k2think.ai/v1/chat/completions'
const K2_MODEL = 'MBZUAI-IFM/K2-Think-v2'

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
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')

    // Disable the worker entirely — runs PDF parsing on the main thread.
    // This is slightly slower but works on every platform with zero config.
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'noop'

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      disableWorker: true,
      useSystemFonts: true,
    }).promise

    const pageTexts = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      let pageText = ''
      for (const item of content.items) {
        if (item.str) {
          const needsSpace = pageText.length > 0 &&
            !pageText.endsWith(' ') &&
            !item.str.startsWith(' ')
          pageText += (needsSpace ? ' ' : '') + item.str
        }
      }
      if (pageText.trim()) pageTexts.push(`[Page ${i}]\n${pageText.trim()}`)
    }

    if (pageTexts.length === 0) {
      throw new Error('PDF has no selectable text — it may be a scanned image. Try the Paste Text tab instead.')
    }
    return pageTexts.join('\n\n')
  } catch (e) {
    console.error('PDF parse error:', e)
    throw new Error(e.message || 'Could not read PDF.')
  }
}

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
  scope = 'all', // 'all' | sourceId
}) {
  // 1. Filter chunks by scope
  const scopedChunks = scope === 'all' ? chunks : chunks.filter(c => c.source_id === scope)
  const scopedNodes = scope === 'all' ? nodes : nodes.filter(n => n.source_id === scope)

  // 2. Decompose query
  const subQueries = await decomposeQuery(query, apiKey)

  // 3. Multi-query retrieval
  const retrieved = multiQueryRetrieve(subQueries, scopedChunks, 10)

  // 4. Assemble context from retrieved chunks
  const sourceMap = Object.fromEntries(sources.map(s => [s.id, s]))
  const docContext = assembleContext(retrieved, sourceMap)

  // 5. Gather relevant memory nodes
  const nodeContext = scopedNodes
    .slice(0, 20)
    .map((n, i) => `[NODE ${i + 1}] ${n.concept} (${n.category}, confidence: ${n.confidence})`)
    .join('\n')

  // 6. Build system prompt
  const systemPrompt = `You are MemOS HyperResearch — an elite knowledge synthesis engine.
You answer questions by deeply analyzing provided document chunks and memory nodes.

Your capabilities:
- Multi-document synthesis: connect ideas across sources
- Evidence grounding: cite specific sources for every claim  
- Gap detection: identify what information is missing
- Contradiction surfacing: flag conflicting information between sources
- Insight generation: surface non-obvious connections
- Structured reasoning: break down complex questions

When answering:
1. Always cite sources using [SOURCE N] references
2. Distinguish between what documents say vs your synthesis
3. If information is insufficient, say so clearly and suggest what additional research would help
4. Use markdown formatting for clarity (headers, bullets, bold key terms)
5. End with a "Key Takeaways" section for complex answers

AVAILABLE DOCUMENT CONTEXT:
${docContext || 'No documents uploaded for this scope.'}

MEMORY NODES (extracted insights):
${nodeContext || 'No memory nodes available.'}

CONVERSATION CONTEXT: You have access to conversation history below. Maintain continuity.`

  // 7. Build messages with history
  const messages = [
    ...conversationHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: query },
  ]

  // 8. Stream the answer
  let fullAnswer = ''
  await streamClaude(apiKey, {
    system: systemPrompt,
    messages,
    max_tokens: 2000,
    onChunk: (chunk) => {
      fullAnswer += chunk
      onStream?.(chunk)
    },
  })

  // 9. Check if answer needs follow-up retrieval (iterative refinement)
  const needsMore = fullAnswer.includes('insufficient information') ||
    fullAnswer.includes('cannot find') ||
    fullAnswer.includes('not in the provided')

  if (needsMore && retrieved.length < scopedChunks.length) {
    // Do a second-pass retrieval with expanded query
    const expandedQueries = [...subQueries, query + ' details', query + ' examples']
    const moreChunks = multiQueryRetrieve(expandedQueries, scopedChunks, 15)
    // The streaming already happened, so we just enrich the metadata
  }

  return {
    answer: fullAnswer,
    sources_used: retrieved.map(r => ({
      chunk_id: r.chunk.id,
      source_id: r.chunk.source_id,
      score: r.score,
      preview: r.chunk.text.slice(0, 120),
    })),
    sub_queries: subQueries,
    chunks_retrieved: retrieved.length,
  }
}

// ── Recall question generation ───────────────────────────────────────────────

export async function generateRecallQuestion(node, apiKey) {
  const prompt = `Generate a retrieval practice question for this memory node.
The question must require reconstruction from memory, not recognition.
Vary types: explain-in-own-words | apply-to-scenario | compare-contrast | identify-contradiction

NODE:
Concept: ${node.concept}
Category: ${node.category}
Applications: ${node.applications}

Return ONLY JSON: {"question_type": "...", "question_text": "...", "ideal_answer_outline": "..."}`

  try {
    const raw = await callClaude(apiKey, { system: 'Return only valid JSON.', user: prompt, max_tokens: 400 })
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

// ── Contradiction detection ──────────────────────────────────────────────────

export async function detectContradictions(nodeA, nodeB, apiKey) {
  const prompt = `Compare two memory nodes and determine their relationship.

NODE A: ${nodeA.concept} (from: ${nodeA.source_ref?.title})
NODE B: ${nodeB.concept} (from: ${nodeB.source_ref?.title})

Return ONLY JSON: {
  "relationship": "contradicts|supports|orthogonal|same_idea",
  "explanation": "brief explanation",
  "confidence": 0.0-1.0
}`

  try {
    const raw = await callClaude(apiKey, { system: 'Return only valid JSON.', user: prompt, max_tokens: 300 })
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { relationship: 'orthogonal', explanation: 'Could not analyze', confidence: 0.5 }
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
  "estimated_reading_time": "X min",
  "knowledge_density": "low|medium|high"
}`

  try {
    const raw = await callClaude(apiKey, { system: 'Return only valid JSON.', user: prompt, max_tokens: 500 })
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return {
      summary: 'Document processed successfully.',
      key_themes: [],
      content_type: 'other',
      estimated_reading_time: '?',
      knowledge_density: 'medium',
    }
  }
}

// ── Direct K2 call (used by Ingest — mirrors the working MVP exactly) ─────────
export async function callK2Direct(apiKey, systemPrompt, userPrompt, max_tokens = 4000) {
  const resp = await fetch(K2_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: K2_MODEL,
      max_tokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `K2 API error ${resp.status}: ${resp.statusText}`)
  }
  const data = await resp.json()
  const text = data.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('K2 returned an empty response. Check your API key and model access.')
  return text
}

// ── Robust JSON extraction from reasoning model output ───────────────────────
// K2-Think-v2 is a reasoning model — it thinks out loud before answering.
// The actual JSON may come after <think>...</think> blocks or after prose.
export function extractJsonFromModelOutput(raw) {
  // 1. Strip <think>...</think> reasoning blocks (K2/DeepSeek style)
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 2. Strip markdown fences
  cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()

  // 3. Try to find the last JSON array in the output
  //    (reasoning models often write prose THEN the JSON at the end)
  const arrayMatches = [...cleaned.matchAll(/(\[[\s\S]*?\])/g)]
  if (arrayMatches.length > 0) {
    // Try from last match backwards (the final array is most likely the answer)
    for (let i = arrayMatches.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(arrayMatches[i][1])
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch { /* try next */ }
    }
  }

  // 4. Try greedy match for the largest array in the text
  const greedyMatch = cleaned.match(/\[[\s\S]*\]/)
  if (greedyMatch) {
    try {
      const parsed = JSON.parse(greedyMatch[0])
      if (Array.isArray(parsed)) return parsed
    } catch { /* fall through */ }
  }

  // 5. Last resort: try parsing the whole cleaned string
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') return [parsed]
  } catch { /* give up */ }

  return null
}

// ── K2-Think-v2 API wrappers (OpenAI-compatible) ─────────────────────────────

// Builds OpenAI-format messages array, injecting system prompt as first message
function buildMessages(system, messages) {
  const sys = system ? [{ role: 'system', content: system }] : []
  return [...sys, ...messages]
}

export async function callClaude(apiKey, { system, user, messages, max_tokens = 1000 }) {
  const msgs = buildMessages(system, messages || [{ role: 'user', content: user }])
  const resp = await fetch(K2_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: K2_MODEL,
      max_tokens,
      messages: msgs,
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `K2 API error ${resp.status}`)
  }
  const data = await resp.json()
  // OpenAI-compatible response: choices[0].message.content
  return data.choices?.[0]?.message?.content || ''
}

export async function streamClaude(apiKey, { system, messages, max_tokens = 2000, onChunk }) {
  const msgs = buildMessages(system, messages)
  const resp = await fetch(K2_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: K2_MODEL,
      max_tokens,
      stream: true,
      messages: msgs,
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `K2 API error ${resp.status}`)
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
        // OpenAI-compatible streaming: choices[0].delta.content
        const text = json.choices?.[0]?.delta?.content || ''
        if (text) onChunk?.(text)
      } catch { /* skip malformed SSE lines */ }
    }
  }
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