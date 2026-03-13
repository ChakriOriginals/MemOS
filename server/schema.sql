-- MemOS PostgreSQL Schema
-- Run once to initialize the database

CREATE TABLE IF NOT EXISTS sources (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  author       TEXT DEFAULT '',
  type         TEXT DEFAULT 'pdf',
  size_label   TEXT DEFAULT '',
  status       TEXT DEFAULT 'pending',
  error        TEXT DEFAULT '',
  node_count   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  metadata     JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS chunks (
  id           TEXT PRIMARY KEY,
  source_id    TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  chunk_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nodes (
  id           TEXT PRIMARY KEY,
  source_id    TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  concept      TEXT NOT NULL,
  category     TEXT DEFAULT 'fact',
  confidence   REAL DEFAULT 0.8,
  applications TEXT DEFAULT '',
  source_quote TEXT DEFAULT '',
  source_ref   JSONB DEFAULT '{}',
  tags         JSONB DEFAULT '[]',
  fsrs_state   JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_chat (
  id           TEXT PRIMARY KEY,
  role         TEXT NOT NULL,
  content      TEXT NOT NULL,
  meta         JSONB DEFAULT '{}',
  error        BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_chunks_source   ON chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_nodes_source    ON nodes(source_id);
CREATE INDEX IF NOT EXISTS idx_chat_created    ON research_chat(created_at);