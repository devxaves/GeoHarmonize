-- BhoomiSetu: National Land Acquisition Control & Compliance Platform
-- Migration 0001: Initial Schema
-- All tables per LAND_ACQUISITION_PLATFORM_SPECIFICATION.md Section 3

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- PostGIS: attempt to enable; if unsupported on this Neon tier, geometry lives in jsonb columns
-- and spatial operations are done in application code (turf.js)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Migration tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  id          SERIAL PRIMARY KEY,
  filename    TEXT UNIQUE NOT NULL,
  applied_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id      TEXT UNIQUE NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('lrb','collector','state_admin','central_ministry','citizen')),
  jurisdiction  TEXT, -- district/state code the user is scoped to, null for central roles
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PROJECTS (Land Acquisition Projects)
-- ============================================================
CREATE TABLE projects (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  land_requiring_body TEXT NOT NULL,
  ministry          TEXT,
  state             TEXT NOT NULL,
  district          TEXT NOT NULL,
  project_type      TEXT, -- highway, railway, irrigation, industrial corridor, etc.
  alignment_geojson JSONB, -- project alignment/boundary as GeoJSON
  current_stage     TEXT NOT NULL DEFAULT 'proposal'
                      CHECK (current_stage IN (
                        'proposal','sia','section_11','section_19','award',
                        'compensation','mutation','possession','rr','closed'
                      )),
  stage_started_at  TIMESTAMPTZ DEFAULT now(),
  status_flag       TEXT NOT NULL DEFAULT 'green' CHECK (status_flag IN ('green','amber','red','lapsed')),
  risk_score        NUMERIC(5,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PARCELS (Individual land parcels, ULPIN-keyed)
-- ============================================================
CREATE TABLE parcels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ulpin             TEXT UNIQUE NOT NULL, -- 14-digit Bhu-Aadhaar
  project_id        UUID REFERENCES projects(id),
  survey_number     TEXT,
  village           TEXT,
  district          TEXT,
  state             TEXT,
  area_hectares     NUMERIC(10,4),
  land_type         TEXT, -- agricultural, commercial, forest, etc.
  geometry_geojson  JSONB NOT NULL, -- Polygon/MultiPolygon GeoJSON
  ownership_status  TEXT DEFAULT 'clear' CHECK (ownership_status IN ('clear','disputed','under_verification')),
  litigation_flag   BOOLEAN DEFAULT false,
  risk_score        NUMERIC(5,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- OWNERS (Land owners linked to parcels)
-- ============================================================
CREATE TABLE owners (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id   UUID REFERENCES parcels(id),
  name        TEXT NOT NULL,
  contact     TEXT,
  bank_ref    TEXT, -- masked/last-4 only, never store full account numbers
  is_current  BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS (Section 11 / Section 19 statutory notifications)
-- ============================================================
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID REFERENCES projects(id),
  section       TEXT NOT NULL CHECK (section IN ('section_11','section_19')),
  notified_on   DATE NOT NULL,
  deadline_on   DATE NOT NULL, -- notified_on + 12 months, computed at insert time
  document_id   UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AWARDS (Compensation awards per parcel)
-- ============================================================
CREATE TABLE awards (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id            UUID REFERENCES projects(id),
  parcel_id             UUID REFERENCES parcels(id),
  award_date            DATE,
  market_value          NUMERIC(14,2),
  solatium_pct          NUMERIC(5,2) DEFAULT 100,
  additional_amount_pct NUMERIC(5,2) DEFAULT 12,
  total_compensation    NUMERIC(14,2),
  document_id           UUID,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- COMPENSATION PAYMENTS (Disbursement tracking)
-- ============================================================
CREATE TABLE compensation_payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  award_id         UUID REFERENCES awards(id),
  amount_assessed  NUMERIC(14,2),
  amount_disbursed NUMERIC(14,2) DEFAULT 0,
  status           TEXT DEFAULT 'assessed' CHECK (status IN ('assessed','sanctioned','disbursed','failed')),
  disbursed_on     DATE,
  mock_pfms_ref    TEXT, -- returned by the mock PFMS adapter
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MUTATIONS (Title transfer in revenue records)
-- ============================================================
CREATE TABLE mutations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id       UUID REFERENCES parcels(id),
  mutation_status TEXT DEFAULT 'pending' CHECK (mutation_status IN ('pending','filed','completed')),
  filed_on        DATE,
  completed_on    DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AFFECTED FAMILIES (R&R tracking per family)
-- ============================================================
CREATE TABLE affected_families (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id           UUID REFERENCES parcels(id),
  family_ref          TEXT NOT NULL, -- anonymized reference code
  displaced           BOOLEAN DEFAULT false,
  compensation_status TEXT DEFAULT 'pending',
  housing_status      TEXT DEFAULT 'pending',
  employment_status   TEXT DEFAULT 'pending',
  livelihood_restored BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DOCUMENTS (OCR-processed uploads)
-- ============================================================
CREATE TABLE documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID REFERENCES projects(id),
  filename          TEXT NOT NULL,
  doc_type          TEXT, -- notification, award, sia_report
  raw_ocr_text      TEXT,
  ner_entities      JSONB,
  discrepancy_flags JSONB, -- e.g. area mismatch vs. parcels table
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RISK SCORES (Explainable risk assessments)
-- ============================================================
CREATE TABLE risk_scores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project','parcel')),
  entity_id   UUID NOT NULL,
  score       NUMERIC(5,2) NOT NULL,
  reasons     JSONB NOT NULL, -- [{ factor, weight, explanation }]
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- GRIEVANCES (Citizen complaints)
-- ============================================================
CREATE TABLE grievances (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id    UUID REFERENCES parcels(id),
  submitted_by TEXT, -- ULPIN or citizen reference
  message      TEXT NOT NULL,
  status       TEXT DEFAULT 'open' CHECK (status IN ('open','in_review','resolved')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT LOG (Stage transitions and data changes)
-- ============================================================
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID REFERENCES users(id),
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  action       TEXT NOT NULL,
  before_state JSONB,
  after_state  JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MOCK ADAPTER LOG (Tracking mock external system calls)
-- ============================================================
CREATE TABLE mock_adapter_log (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source    TEXT NOT NULL, -- mock-DILRMP, mock-LACRRIS, mock-BhoomiRashi, mock-PFMS
  request   JSONB,
  response  JSONB,
  called_at TIMESTAMPTZ DEFAULT now()
);
