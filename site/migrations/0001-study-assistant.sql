-- Additive and idempotent: independent of both search index rebuilds.
CREATE TABLE IF NOT EXISTS study_usage (
  bucket TEXT PRIMARY KEY,
  used INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS study_cache (
  key TEXT PRIMARY KEY,
  answer TEXT NOT NULL,
  expires INTEGER NOT NULL
);
