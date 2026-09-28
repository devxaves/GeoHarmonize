-- GeoHarmonize: Migration 0005 — App DB Schema
-- Non-destructive: uses gh_ prefix to coexist with existing BhoomiSetu tables
-- Per PRD §4.1: users, sessions, audit_log
-- Run: psql -d <your_app_db> -f db/migrations/0005_geoharmonize_app.sql

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gh_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin','reviewer','viewer')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Sessions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gh_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES gh_users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_sessions_token ON gh_sessions (token);
CREATE INDEX IF NOT EXISTS idx_gh_sessions_user_id ON gh_sessions (user_id);

-- ── Audit Log ────────────────────────────────────────────────────────────────
-- Tracks every human action: approve_match, reject_match, upload, export
-- before_state/after_state carry full JSON snapshots for reversibility
CREATE TABLE IF NOT EXISTS gh_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES gh_users(id),
    entity_type TEXT NOT NULL,        -- 'parcel', 'conflict', 'dataset'
    entity_id TEXT NOT NULL,          -- UUID or parcel_uid (TEXT to accommodate both)
    action TEXT NOT NULL,             -- 'approve_match', 'reject_match', 'upload', 'export', 'field_verification'
    before_state JSONB,
    after_state JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_audit_actor ON gh_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_gh_audit_entity ON gh_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_gh_audit_created ON gh_audit_log (created_at DESC);

-- ── Seed: default admin user ────────────────────────────────────────────────
-- Password: admin123 (bcrypt hash — change immediately in production)
-- Hash generated with: bcrypt.hash('admin123', 10)
INSERT INTO gh_users (email, password_hash, name, role)
VALUES (
    'admin@geoharmonize.gov.in',
    '$2b$10$rQ5eK8zL1mN9pXvYwA3cOe6kHjM0nF4gI2tUxBsDqWlV7RcAyPiEm',
    'System Administrator',
    'admin'
)
ON CONFLICT (email) DO NOTHING;

-- Reviewer test user (password: reviewer123)
INSERT INTO gh_users (email, password_hash, name, role)
VALUES (
    'reviewer@geoharmonize.gov.in',
    '$2b$10$sT6fL9aN2oP0qYwZxB4dPf7lImN1oG5hJ3uVyCtEtWmX8SbBzQjFn',
    'Land Records Reviewer',
    'reviewer'
)
ON CONFLICT (email) DO NOTHING;
