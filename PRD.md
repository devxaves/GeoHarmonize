# Product Requirements Document
## GeoSync — AI-Assisted Multi-Source Geospatial Land Record Integration Platform
### SIH Problem Statement 26013 (Ministry of Rural Development / Department of Land Resources)

**Document purpose:** This is a build specification for an autonomous coding agent. It is written to remove ambiguity, not to explain background — read it top to bottom before writing any code, and follow the build order in Section 9 sequentially. Do not skip ahead to UI polish before the core engine in Phase 2 works end-to-end.

---

## 1. What this system is (and is not)

**Is:** A platform that ingests messy, multi-source, multi-format land/geospatial data (drone imagery, cadastral maps, revenue records, municipal GIS layers, GNSS points) and produces a single, confidence-scored, harmonized parcel database — with every automated decision explainable, reversible, and routed to a human reviewer when uncertain.

**Is not:** An autonomous system that finalizes legal land ownership, deletes/overwrites records, or makes irreversible decisions without a human approval step. Every automated action must be logged and reversible. This constraint is non-negotiable and must be reflected in the data model (append-only versioning) and the UI (no destructive one-click actions without confirmation + audit log entry).

---

## 2. Architecture

Two services, communicating over REST/JSON. Do not merge them into one codebase — the split is intentional (see rationale below).

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│   WEB APP (apps/web)        │  REST   │   GEO ENGINE (apps/geo-engine)    │
│   Next.js 15 (App Router)   │ ──────► │   FastAPI (Python)                │
│   TypeScript                │ ◄────── │   PostGIS-enabled PostgreSQL      │
│   - Auth, RBAC, sessions    │  JSON   │   - CRS transform                 │
│   - Dashboard, archive      │         │   - Spatial matching (IoU/       │
│   - Conflict review UI      │         │     Hausdorff)                    │
│   - Upload UI (OCR trigger) │         │   - Topology correction           │
│   - Map (MapLibre GL)       │         │   - Confidence scoring            │
│   - Audit log storage       │         │   - Building footprint CV         │
└─────────────────────────────┘         └──────────────────────────────────┘
        │                                          │
        ▼                                          ▼
  Postgres (app DB: users, sessions,        PostGIS Postgres (spatial DB:
  audit_log, review_queue metadata)         parcels, geometries, conflicts)
        │                                          │
        └──────────────┬───────────────────────────┘
                        ▼
                 MinIO / local disk
           (raw uploaded rasters, vectors, scans)
```

**Why two services, not one Next.js monolith:** Real spatial-matching math (polygon IoU, Hausdorff distance, topology repair, CRS transformation) needs PostGIS + GeoPandas/Shapely/GDAL. That ecosystem is Python-native. Forcing this into JavaScript means reimplementing geometry algorithms by hand — slower to build and more error-prone under time pressure. Next.js stays the app-facing layer (auth, UI, review workflows); Python owns anything that touches geometry.

---

## 3. Technology stack (exact, do not substitute without reason)

### Web app (`apps/web`)
- Next.js 15, App Router, TypeScript (strict mode)
- Tailwind CSS v4, configured with BhoomiSetu's existing warm government theme tokens (see Section 11 — do not introduce a new palette)
- Radix UI primitives + shadcn/ui components built on top of them (dialogs, tabs, dropdowns, tooltips, command palette, sheet/drawer panels) — reuse BhoomiSetu's existing Radix setup rather than adding a second component library
- **Framer Motion** — required for interactive micro-animations: page/route transitions, conflict-queue expand/collapse, map marker pop-in on data load, animated counters on dashboard KPIs, hover/press states on cards and buttons. This is what makes the UI feel alive rather than static; use it deliberately, not decoratively (see Section 11 for where animation belongs vs. where it's noise).
- MapLibre GL JS + `@turf/turf` for client-side spatial helpers
- Mapbox GL Draw (for drawing/inspecting boundaries in the review UI)
- Recharts (dashboard charts) — animate chart entry (bars growing in, counters ticking up) rather than rendering static charts
- `pg` (raw parameterized SQL, no ORM) for the app DB
- bcryptjs + httpOnly cookie sessions for auth (no third-party auth vendor)

### Geo engine (`apps/geo-engine`)
- FastAPI (Python 3.11+)
- PostgreSQL + PostGIS extension (separate DB/schema from the app DB)
- GeoPandas, Shapely, GDAL/OGR, Rasterio, PyProj
- RapidFuzz (attribute/name fuzzy matching)
- scikit-learn (simple weighted confidence model — do not use a black-box deep model here; the score must be explainable)
- Pytesseract + Tesseract OCR binary (for scanned revenue record digitization)
- `samgeo` (SAM for geospatial) OR a pretrained `torchvision` Mask R-CNN — for building footprint extraction. Use a **pretrained model only**; do not attempt to train from scratch.
- Uvicorn as the ASGI server

### Storage
- MinIO for raw file storage (rasters, uploaded scans) — but if MinIO setup adds friction, fall back to local filesystem storage under `apps/geo-engine/storage/` for the MVP. Document this fallback clearly in the README.

### Explicitly excluded (do not add these; see Section 8)
- Docker as a hard requirement (must be optional — see Section 10)
- Blockchain / Hyperledger / IPFS
- Federated learning frameworks
- Kubernetes / Kafka (mention only in an architecture doc, never actually stand these up)
- BERT/transformer-based schema matching (RapidFuzz is sufficient and faster)
- Any third-party LLM/chatbot feature unless explicitly requested later

---

## 4. Data model

### 4.1 App DB (Postgres, plain — no PostGIS needed here)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin','reviewer','viewer')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    entity_type TEXT NOT NULL,       -- 'parcel', 'conflict', 'dataset'
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,            -- 'approve_match', 'reject_match', 'upload', 'export'
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 Geo engine DB (PostGIS-enabled Postgres)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE dataset_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,       -- 'drone_ori','dsm_dtm','cadastral','revenue','municipal','utility','gnss','building_footprint'
    original_filename TEXT,
    source_crs TEXT,
    target_crs TEXT DEFAULT 'EPSG:4326',
    transformation_method TEXT,
    horizontal_accuracy_m NUMERIC,
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    storage_path TEXT
);

CREATE TABLE urban_parcel (
    parcel_uid TEXT PRIMARY KEY,     -- format: IN-{STATE}-{DISTRICT}-{ULB}-{WARD}-{HASH}
    ulpin TEXT,                      -- 14-digit ULPIN if available/generated
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    survey_number TEXT,
    plot_number TEXT,
    property_id TEXT,
    owner_name TEXT,
    owner_name_normalized TEXT,
    recorded_area_sqm NUMERIC,
    geometry_area_sqm NUMERIC,
    land_use TEXT,
    source_system TEXT,
    source_dataset_id UUID REFERENCES dataset_metadata(id),
    geometry_confidence NUMERIC,     -- 0.0–1.0
    attribute_confidence NUMERIC,    -- 0.0–1.0
    validation_status TEXT DEFAULT 'unverified', -- 'unverified','auto_linked','human_approved','rejected'
    version INT DEFAULT 1,
    superseded_by TEXT REFERENCES urban_parcel(parcel_uid),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_parcel_geom ON urban_parcel USING GIST (geometry);

CREATE TABLE spatial_conflicts (
    conflict_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_uid_a TEXT REFERENCES urban_parcel(parcel_uid),
    parcel_uid_b TEXT REFERENCES urban_parcel(parcel_uid),
    conflict_type TEXT NOT NULL,     -- 'boundary_mismatch','area_mismatch','overlap','gap','attribute_mismatch','duplicate_owner'
    geometry_diff GEOMETRY(Geometry, 4326),
    difference_value NUMERIC,
    confidence_score NUMERIC NOT NULL,
    score_reasons JSONB NOT NULL,    -- [{factor, weight, contribution, explanation}]
    recommended_action TEXT,         -- 'auto_merge','human_review','reject'
    status TEXT DEFAULT 'open',      -- 'open','approved','rejected','field_verification_required'
    assigned_to TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE change_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_uid TEXT REFERENCES urban_parcel(parcel_uid),
    change_type TEXT,                -- 'new_building','boundary_shift','subdivision','demolition'
    detected_from_dataset_id UUID REFERENCES dataset_metadata(id),
    confidence NUMERIC,
    requires_verification BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Hard rule for the agent:** Never `UPDATE` or `DELETE` a row in `urban_parcel`. To change a parcel, insert a new row with an incremented `version` and set `superseded_by` on the old row. This is the append-only versioning requirement from Section 1.

---

## 5. Confidence scoring formula (implement exactly this, do not invent a different one)

```python
score = (
    0.35 * geometry_overlap_score +      # IoU between candidate geometries
    0.20 * attribute_similarity_score +  # RapidFuzz on names/IDs
    0.15 * identifier_match_score +      # survey number / property ID exact or fuzzy match
    0.15 * source_reliability_score +    # static weight per source_type, e.g. GNSS=0.95, drone=0.90, revenue=0.70
    0.15 * temporal_recency_score        # newer data scores higher
)
```

Thresholds:
- `score >= 0.90` → `validation_status = 'auto_linked'` (still logged, still reversible via the review UI)
- `0.60 <= score < 0.90` → `recommended_action = 'human_review'`, appears in the conflict queue
- `score < 0.60` → treated as unresolved/new feature, never auto-merged

Every score must be stored with its `score_reasons` breakdown (see schema above) and the UI must render this breakdown — never show a bare number.

---

## 6. Core features (build in this priority order)

1. **CRS detection & transformation** — on any vector/raster upload, detect or read source CRS, transform to EPSG:4326, log `transformation_method` and estimated accuracy in `dataset_metadata`. Never silently transform without recording it.
2. **Geometry validation & topology correction** — run `ST_MakeValid`, detect and log slivers (area < configurable threshold), gaps, and overlaps before any matching runs.
3. **Spatial matching engine** — for a new dataset upload, generate candidate matches against existing `urban_parcel` rows using bounding-box + `ST_DWithin`, then score with IoU/Hausdorff distance.
4. **Attribute matching** — RapidFuzz comparison of owner names, survey numbers, plot numbers; normalize case/punctuation/transliteration variants before comparing.
5. **Confidence scoring & conflict generation** — apply the formula in Section 5; write results to `spatial_conflicts`.
6. **Conflict review queue (UI + API)** — reviewer sees each conflict with both geometries rendered on the map, the score breakdown, and Approve / Reject / Request Field Verification actions. Every action writes to `audit_log`.
7. **Building footprint extraction (CV)** — accept an ORI raster, run the pretrained segmentation model, output candidate footprint polygons with a confidence score, feed into the matching pipeline as another dataset.
8. **OCR + digitization for scanned revenue records** — Tesseract pass, extract survey number/owner/area via regex + simple NER, output as a structured dataset for matching.
9. **Change detection** — compare two dataset vintages for the same area, flag geometric/attribute deltas as `change_events`, labeled "verification required" — never "unauthorized" or "illegal."
10. **Web-GIS dashboard & map** — MapLibre map with layer toggles (cadastral / drone / building footprints / conflicts), before/after harmonization view, metrics dashboard (parcels processed, conflicts auto-resolved vs. flagged, manual-effort-reduction estimate).
11. **Export / interoperability** — GeoJSON and GeoPackage export endpoints; one REST endpoint returning parcels in a clean, documented JSON contract (this is your "inter-departmental exchange" story).

---

## 7. API contract (implement exactly these routes; extend only if a feature above requires it)

### Geo engine (FastAPI, prefix `/api/geo`)
```
POST   /api/geo/datasets/upload            multipart upload, returns dataset_metadata
GET    /api/geo/datasets/{id}/validation   geometry/CRS validation report
POST   /api/geo/datasets/{id}/harmonize    triggers matching+scoring pipeline
GET    /api/geo/parcels                    list, filterable by bbox/status
GET    /api/geo/parcels/{parcel_uid}       full detail incl. version history
GET    /api/geo/conflicts                  list, filterable by status
POST   /api/geo/conflicts/{id}/decision    body: {action, actor_id, notes}
GET    /api/geo/changes                    list change_events
GET    /api/geo/export/geojson             filtered export
GET    /api/geo/export/geopackage          filtered export
```

### Web app (Next.js route handlers, prefix `/api`)
```
POST   /api/auth/register | /api/auth/login | /api/auth/logout | /api/auth/me
GET    /api/dashboard                      aggregated KPIs (proxies/joins geo-engine data)
GET    /api/audit                          audit log, filterable
POST   /api/upload                         forwards file to geo-engine, stores OCR/NER result
GET    /api/documents                      list processed scanned documents
```

---

## 8. Explicit exclusions — do not build these even if they seem like natural extensions

- No blockchain/audit-via-ledger — the `audit_log` table with before/after JSONB is sufficient and was chosen deliberately over blockchain (see PRD history: centralized trusted authority already exists, blockchain solves a trust problem this system doesn't have).
- No federated learning.
- No full 3D digital twin / BIM-GIS / CityGML pipeline. If a 3D visual is wanted later, it means extruding building footprints by DSM height in MapLibre — a rendering trick, not a subsystem.
- No training of CV models from scratch — pretrained models only.
- No multilingual UI, no chatbot/LLM assistant — out of scope for this MVP.
- No Kubernetes/Kafka actually deployed.

If a task seems to require one of these, stop and flag it rather than building it.

---

## 9. Build order (follow sequentially — do not start Phase 3 before Phase 2 works end-to-end)

**Phase 0 — Scaffolding (start inside the existing BhoomiSetu repository — do not start from an empty folder)**
- The existing BhoomiSetu Next.js project is the starting point, not a fresh scaffold. Do not create a new `apps/web` from scratch — work inside the existing BhoomiSetu repo root and treat it as `apps/web`'s content in place.
- Add a new sibling folder `geo-engine/` at the same level as the existing BhoomiSetu app root (i.e., if BhoomiSetu's `package.json` lives at the repo root, `geo-engine/` sits next to it, not nested inside `app/` or `lib/`). This keeps the two services cleanly separated without forcing a monorepo restructure of code that already works.
- Inside the existing BhoomiSetu repo, per Section 8's exclusion list: remove the RFCTLARR 10-stage workflow, compensation/award/Solatium math, PFMS disbursement, mutation-lag tracker, R&R tracking, and the federated mock adapters (DILRMP/LACRRIS/BhoomiRashi/PFMS) — delete these routes/pages/lib files entirely rather than leaving them dormant, so the codebase doesn't carry dead statutory-compliance logic that has nothing to do with this problem statement.
- Keep as-is: auth/session/RBAC (`lib/auth.ts`, `middleware.ts`), `audit_log` table pattern, MapLibre map components (`components/map/`), OCR/NER pipeline (`lib/ocr.ts`, `lib/ner.ts`), the ULPIN generator, and the existing Tailwind theme tokens (see Section 11).
- Repurpose (don't discard) the existing `discrepancy.ts` and `risk-engine.ts` patterns — their weighted, explainable scoring *shape* is exactly what Section 5's confidence formula needs; port the pattern into the new geo-engine with geometric/spatial factors replacing the old legal/statutory ones.
- App DB schema migration script (extending BhoomiSetu's existing migrations, not replacing them); geo-engine DB schema migration script (plain `.sql` files run via a small script, no heavy migration framework needed).

**Phase 1 — Auth & shell**
- Register/login/session (bcrypt + cookies), RBAC (admin/reviewer/viewer), protected route middleware.
- Basic layout, nav, empty dashboard page.

**Phase 2 — Core geo engine (the part that must work before anything else matters)**
- Dataset upload endpoint, CRS detection/transform, geometry validation.
- Spatial matching + confidence scoring on two sample datasets (one legacy cadastral GeoJSON, one "new" GeoJSON with deliberately shifted/renamed features).
- Conflict generation, stored with score_reasons.
- Prove this works via a script/test before touching UI: upload two sample files, confirm conflicts appear with sane scores.

**Phase 3 — Review UI**
- Map view rendering both conflicting geometries.
- Conflict queue list + detail panel with score breakdown.
- Approve/Reject/Defer actions wired to `/conflicts/{id}/decision`, writing to `audit_log`.

**Phase 4 — CV & OCR modules**
- Building footprint extraction on one sample ORI image.
- OCR + regex extraction on one sample scanned revenue record image.
- Both feed into the Phase 2 pipeline as new datasets.

**Phase 5 — Change detection, dashboard, export**
- Two-vintage comparison → change_events.
- Metrics dashboard (Recharts).
- GeoJSON/GeoPackage export buttons.

**Phase 6 — Polish pass**
- Apply Section 11 (design system) throughout.
- Empty states, loading states, error states for every screen.
- Full manual run-through of Section 12's verification checklist.

---

## 10. Setup — must work without Docker

Docker Compose may be provided as a *convenience*, but the primary documented path must be manual setup, since this needs to run without Docker:

```bash
# Geo engine
cd apps/geo-engine
python -m venv venv && source venv/bin/activate     # or venv\Scripts\activate on Windows
pip install -r requirements.txt
# requires local PostgreSQL with PostGIS extension enabled, and a local Tesseract install
psql -d geoharmonize -f migrations/001_init.sql
uvicorn main:app --reload --port 8000

# Web app
cd apps/web
npm install
# requires a local PostgreSQL DB for the app schema
psql -d geoharmonize_app -f migrations/001_init.sql
npm run dev   # runs on port 3000, calls geo-engine at http://localhost:8000
```

README must state plainly: PostgreSQL with PostGIS must be installed locally (link to postgis.net install docs per OS), Tesseract OCR binary must be installed locally (not just the Python wrapper), and both `.env`/`.env.local` files must point to local DB connection strings. Docker Compose, if included, is optional and lives in a `docker/` folder with its own README — it must not be a required step.

---

## 11. UI / design requirements — read this section carefully

The frontend must look like production government software, not a generic AI-generated template — but "not AI-like" means *not lazy or default*, not *not polished*. This system should be interactive, animated, and built with real UI libraries at full effort, not stripped down to flat static screens.

### Color palette — keep BhoomiSetu's existing theme exactly, do not introduce a new palette

The existing BhoomiSetu "Warm Government Theme" is correct and must be carried forward as-is:

| Token | Hex | Use |
|---|---|---|
| Deep Slate | `#0f172a` | Primary dark background / header / nav |
| Saffron / Orange | `#ea580c` | Primary action color, active states, key CTAs |
| Gold | `#f59e0b` | Secondary accent, highlights, amber/warning status |
| Stone | `#fafaf9` | Light background, cards, content surfaces |

Do not swap this for a blue/purple SaaS palette or invent new brand colors. Extend it only with a small, fixed set of **status colors** layered on top of this base (not replacing it) for parcel/conflict states — e.g. green for verified/approved, the existing gold/amber for review-needed, red for conflicts, gray for unverified — applied consistently across map markers, table badges, and dashboard KPIs.

### Typography

Keep BhoomiSetu's existing font stack (Geist, Sora, Space Grotesk) with a defined type scale (12/14/16/20/24/32px) and tabular figures for numeric data (survey numbers, areas, coordinates, ULPINs) — this was already a deliberate, good choice in the original project; don't replace it with default system fonts.

### Interactivity, animation, and component quality — build this at full effort

- **Use Framer Motion throughout, deliberately, not decoratively:** animate route/page transitions, conflict cards expanding/collapsing, map markers popping in as data loads, dashboard KPI counters ticking up on mount, list items staggering in on the conflict queue, smooth hover-lift on interactive cards, and subtle press feedback on buttons. The app should feel responsive and alive, not static.
- **Use shadcn/ui components on top of the existing Radix primitives** for anything not already built in BhoomiSetu (command palettes, sheets/drawers for the conflict detail panel, toasts for action confirmations, skeleton loaders with a subtle shimmer instead of static spinners) — these are real, production-grade components, not generic AI-template output, and reusing them is the right way to get polish quickly.
- **What to still avoid** (these are genuine generic-AI-template tells, distinct from "having animation and polish"): purple-to-blue gradient hero sections that clash with the existing orange/gold theme, glassmorphism/heavy blur effects layered on top of the existing flat government aesthetic, generic emoji-icon feature grids, and centered single-CTA landing pages with no data density. Avoiding these is about taste and consistency with the existing theme — it is not a reason to under-build the interaction design.
- The map is the primary interface, not a decorative element — most screens should default to a map-first layout with data panels docked to the side, using smooth open/close transitions (Framer Motion) rather than instant show/hide.
- Every screen should carry real data density: tables with many rows, working filters, animated but genuinely informative charts — not sparse single-card layouts.

Before finalizing any screen, check it against this test: *would a land-records officer, not a hackathon judge, find this both usable for real work and pleasant to interact with?* A screen that's flat and static because "flat avoids looking AI-generated" is the wrong lesson — the goal is a polished, animated, on-brand interface, just not a generic templated one.

---

## 12. Verification checklist (run through this before considering any phase "done")

- [ ] `npm run dev` and `uvicorn main:app` both start with zero errors on a clean clone + manual setup (no Docker)
- [ ] Uploading a sample cadastral GeoJSON and a deliberately-shifted/renamed second GeoJSON produces at least one entry in `spatial_conflicts` with a sane confidence score and non-empty `score_reasons`
- [ ] The conflict review UI renders both geometries on the map and the score breakdown is human-readable (not just a number)
- [ ] Approving or rejecting a conflict writes an `audit_log` row with correct `before_state`/`after_state`
- [ ] No code path ever runs `UPDATE`/`DELETE` on `urban_parcel` — only inserts with versioning
- [ ] CRS transformation is logged in `dataset_metadata` for every upload, never silent
- [ ] GeoJSON and GeoPackage export endpoints return valid, openable files (verify by opening the GeoPackage in QGIS or similar)
- [ ] Change detection events are labeled "verification required," never phrased as accusations ("illegal," "unauthorized")
- [ ] Every screen has a working empty state and error state, not just the happy path
- [ ] The full demo flow (Section 13) can be run start to finish without a crash

---

## 13. Demo flow to validate against (this is what will actually be shown)

1. Upload a messy legacy cadastral layer + a "new" drone-derived layer with realistic discrepancies (CRS mismatch, name typos, boundary drift, area mismatch) — not artificially perfect data.
2. Trigger harmonization; watch topology corrections and matches happen.
3. Open the conflict queue, inspect one low-confidence match, see the actual reasoning, approve it.
4. View the metrics dashboard: parcels processed, conflicts auto-resolved vs. flagged, estimated manual-effort reduction.
5. Export the harmonized layer as GeoPackage/GeoJSON.

If this flow cannot be completed without errors, the build is not done, regardless of how many features exist.