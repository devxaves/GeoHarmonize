-- BhoomiSetu: Migration 0004 — Replace Clerk auth with DB-based auth
-- Adds password_hash to users, removes clerk_id dependency

-- Add password_hash column
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- Make clerk_id nullable (will be dropped later)
ALTER TABLE users ALTER COLUMN clerk_id DROP NOT NULL;

-- Create sessions table for cookie-based sessions
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Note: Default accounts are created via scripts/seed-auth.ts
-- Run: npx tsx scripts/seed-auth.ts
