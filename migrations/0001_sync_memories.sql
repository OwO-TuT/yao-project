CREATE TABLE IF NOT EXISTS memories (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner, id)
);

CREATE INDEX IF NOT EXISTS idx_memories_owner_created_at
ON memories (owner, created_at DESC);

PRAGMA optimize;
