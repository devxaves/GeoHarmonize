-- GeoHarmonize: Geo Engine DB Schema
-- PostGIS-enabled PostgreSQL (separate DB: geoharmonize_geo)
-- Per PRD §4.2 — run this ONCE on a fresh PostGIS-enabled DB
-- Run: psql -d geoharmonize_geo -f migrations/001_init.sql

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Dataset Metadata ─────────────────────────────────────────────────────────
-- Tracks every uploaded file: source CRS, transformation, accuracy
-- CRS transformation is ALWAYS logged here — never silent (PRD §6.1)
CREATE TABLE IF NOT EXISTS dataset_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL CHECK (source_type IN (
        'drone_ori','dsm_dtm','cadastral','revenue',
        'municipal','utility','gnss','building_footprint'
    )),
    original_filename TEXT,
    source_crs TEXT,
    target_crs TEXT DEFAULT 'EPSG:4326',
    transformation_method TEXT,        -- e.g. 'pyproj:EPSG:7755->EPSG:4326'
    horizontal_accuracy_m NUMERIC,
    feature_count INTEGER,
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    storage_path TEXT,
    validation_report JSONB            -- topology check results
);

-- ── Urban Parcel ─────────────────────────────────────────────────────────────
-- Append-only versioned table. NEVER UPDATE or DELETE rows.
-- To modify a parcel: insert new row (version+1), set superseded_by on old row.
CREATE TABLE IF NOT EXISTS urban_parcel (
    parcel_uid TEXT PRIMARY KEY,       -- format: IN-{STATE}-{DISTRICT}-{ULB}-{WARD}-{HASH}
    ulpin TEXT,                        -- 14-digit ULPIN if available/generated
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    survey_number TEXT,
    plot_number TEXT,
    property_id TEXT,
    owner_name TEXT,
    owner_name_normalized TEXT,        -- lowercase, stripped punctuation, transliterated
    recorded_area_sqm NUMERIC,
    geometry_area_sqm NUMERIC,         -- computed from geometry
    land_use TEXT,
    source_system TEXT,
    source_dataset_id UUID REFERENCES dataset_metadata(id),
    geometry_confidence NUMERIC CHECK (geometry_confidence >= 0 AND geometry_confidence <= 1),
    attribute_confidence NUMERIC CHECK (attribute_confidence >= 0 AND attribute_confidence <= 1),
    validation_status TEXT DEFAULT 'unverified' CHECK (
        validation_status IN ('unverified','auto_linked','human_approved','rejected')
    ),
    version INT DEFAULT 1,
    superseded_by TEXT REFERENCES urban_parcel(parcel_uid),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Spatial index for bounding-box + ST_DWithin queries
CREATE INDEX IF NOT EXISTS idx_parcel_geom ON urban_parcel USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_parcel_status ON urban_parcel (validation_status);
CREATE INDEX IF NOT EXISTS idx_parcel_dataset ON urban_parcel (source_dataset_id);
CREATE INDEX IF NOT EXISTS idx_parcel_survey ON urban_parcel (survey_number);

-- ── Spatial Conflicts ────────────────────────────────────────────────────────
-- Every automated match decision is recorded here with full score_reasons
-- UI must render score_reasons breakdown — never show a bare number (PRD §5)
CREATE TABLE IF NOT EXISTS spatial_conflicts (
    conflict_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_uid_a TEXT REFERENCES urban_parcel(parcel_uid),
    parcel_uid_b TEXT REFERENCES urban_parcel(parcel_uid),
    conflict_type TEXT NOT NULL CHECK (conflict_type IN (
        'boundary_mismatch','area_mismatch','overlap','gap',
        'attribute_mismatch','duplicate_owner'
    )),
    geometry_diff GEOMETRY(Geometry, 4326),   -- delta polygon for map display
    difference_value NUMERIC,                  -- area diff in sqm or % boundary drift
    confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    score_reasons JSONB NOT NULL,              -- [{factor, weight, contribution, explanation}]
    recommended_action TEXT CHECK (recommended_action IN (
        'auto_merge','human_review','reject'
    )),
    status TEXT DEFAULT 'open' CHECK (
        status IN ('open','approved','rejected','field_verification_required')
    ),
    assigned_to TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conflict_status ON spatial_conflicts (status);
CREATE INDEX IF NOT EXISTS idx_conflict_score ON spatial_conflicts (confidence_score);
CREATE INDEX IF NOT EXISTS idx_conflict_geom ON spatial_conflicts USING GIST (geometry_diff)
    WHERE geometry_diff IS NOT NULL;

-- ── Change Events ─────────────────────────────────────────────────────────────
-- Two-vintage comparison results. NEVER label as "unauthorized" or "illegal".
-- Always "verification required" (PRD §6.9 + §12 checklist item)
CREATE TABLE IF NOT EXISTS change_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_uid TEXT REFERENCES urban_parcel(parcel_uid),
    change_type TEXT CHECK (change_type IN (
        'new_building','boundary_shift','subdivision','demolition'
    )),
    detected_from_dataset_id UUID REFERENCES dataset_metadata(id),
    compared_to_dataset_id UUID REFERENCES dataset_metadata(id),
    confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
    geometry_delta GEOMETRY(Geometry, 4326),
    area_delta_sqm NUMERIC,
    description TEXT,                  -- human-readable, never accusatory
    requires_verification BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_parcel ON change_events (parcel_uid);
CREATE INDEX IF NOT EXISTS idx_change_dataset ON change_events (detected_from_dataset_id);
