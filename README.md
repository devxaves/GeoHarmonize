# GeoSync — AI-Assisted Multi-Source Geospatial Land Record Integration Platform

SIH Problem Statement 26013 | Department of Land Resources (DoLR), Ministry of Rural Development, Government of India

## Architecture

Two decoupled services communicating over REST/JSON:

- **Web App** (Next.js 15, TypeScript, Tailwind v4, MapLibre GL, Recharts, Framer Motion) — Auth, RBAC, sessions, conflict review UI, dashboard, audit trail
- **Geo Engine** (FastAPI, Python 3.11, PostGIS, GeoPandas, Shapely, RapidFuzz) — CRS transform, spatial matching (IoU/Hausdorff), topology repair, 5-factor confidence scoring

## Quick Start

### 1. Prerequisites
- Node.js v18+
- Python 3.11+
- PostgreSQL with PostGIS (or Neon serverless Postgres)
- Tesseract OCR (optional, for scanned document OCR)

### 2. Geo Engine Service (Python FastAPI)
```bash
cd geo-engine
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Web App Service (Next.js)
```bash
npm install
npm run migrate
npm run seed
npm run dev
```

## Default Credentials

| Role | Email | Password |
|---|---|---|
| System Administrator | admin@geoharmonize.gov.in | admin123 |
| Land Records Reviewer | reviewer@geoharmonize.gov.in | admin123 |

## 5-Factor Confidence Scoring Formula

Score = 0.35 × IoU + 0.20 × RapidFuzz + 0.15 × Identifier + 0.15 × Reliability + 0.15 × Recency

- score >= 0.90 → Auto-Linked
- 0.60 <= score < 0.90 → Human Review Required
- score < 0.60 → Low Confidence / Unresolved

## Pages

| Route | Purpose |
|---|---|
| /landing | Landing page with pipeline visualization |
| /login | Login |
| /register | Register |
| /dashboard | Executive KPI dashboard |
| /upload | Multi-source data ingestion + harmonization |
| /atlas | Web-GIS conflict review workspace |
| /admin | Admin console (datasets, users, pipeline history) |
| /archive | Digital archive (parcels, conflicts, change events) |
