"""
GeoSync — Geo Engine (FastAPI)
Implements all routes from PRD §7 under prefix /api/geo

Routes:
  POST   /api/geo/datasets/upload
  GET    /api/geo/datasets/{id}/validation
  POST   /api/geo/datasets/{id}/harmonize
  GET    /api/geo/parcels
  GET    /api/geo/parcels/{parcel_uid}
  GET    /api/geo/conflicts
  POST   /api/geo/conflicts/{id}/decision
  GET    /api/geo/changes
  GET    /api/geo/export/geojson
  GET    /api/geo/export/geopackage

Run: uvicorn main:app --reload --port 8000
"""

import json
import os
import tempfile
import uuid
import logging
import structlog
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Literal

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from config import settings
from database import get_db, get_cursor

# ── Configure logging ─────────────────────────────────────────────────────────
logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="GeoSync Geo Engine",
    description="AI-assisted multi-source geospatial land record integration — spatial processing service",
    version="1.0.0",
    docs_url="/api/geo/docs",
    redoc_url="/api/geo/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Storage ───────────────────────────────────────────────────────────────────
STORAGE_PATH = Path(settings.storage_local_path)
STORAGE_PATH.mkdir(parents=True, exist_ok=True)


# ── Pydantic models ───────────────────────────────────────────────────────────

class ConflictDecisionBody(BaseModel):
    action: Literal["approve_match", "reject_match", "field_verification_required"]
    actor_id: str
    notes: Optional[str] = None


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/geo/health")
async def health():
    return {"status": "ok", "service": "geo-engine", "timestamp": datetime.now(timezone.utc).isoformat()}


# ── POST /api/geo/buildings/extract ───────────────────────────────────────────

@app.post("/api/geo/buildings/extract")
async def extract_buildings(
    dsm: UploadFile = File(...),
    dtm: UploadFile = File(...),
    threshold_m: float = Form(2.5),
    min_area_sqm: float = Form(10.0),
):
    """
    Extract building footprints using the nDSM (DSM - DTM) method.
    Returns candidate footprint polygons with confidence values.
    """
    dsm_path = STORAGE_PATH / f"dsm_{uuid.uuid4()}.tif"
    dtm_path = STORAGE_PATH / f"dtm_{uuid.uuid4()}.tif"

    dsm_content = await dsm.read()
    dtm_content = await dtm.read()

    with open(dsm_path, "wb") as f:
        f.write(dsm_content)
    with open(dtm_path, "wb") as f:
        f.write(dtm_content)

    try:
        from pipeline import extract_building_footprints
        footprints, method_info = extract_building_footprints(
            str(dsm_path), str(dtm_path),
            threshold_m=threshold_m,
            min_area_sqm=min_area_sqm,
        )
    except Exception as e:
        raise HTTPException(422, f"Building extraction failed: {str(e)}")

    return {
        "footprints": footprints,
        "method": method_info,
        "count": len(footprints),
    }


# ── POST /api/geo/ocr ──────────────────────────────────────────────────────────

@app.post("/api/geo/ocr")
async def ocr_document(file: UploadFile = File(...)):
    """
    OCR endpoint: extract text from scanned revenue record images.
    Uses pytesseract (Tesseract OCR binary must be installed).
    """
    import pytesseract
    from PIL import Image
    import io

    content = await file.read()
    try:
        image = Image.open(io.BytesIO(content))
    except Exception:
        raise HTTPException(400, "Invalid image file. Supported: PNG, JPEG, TIFF, BMP.")

    try:
        text = pytesseract.image_to_string(image)
    except Exception as e:
        raise HTTPException(500, f"OCR processing failed: {str(e)}")

    if not text.strip():
        raise HTTPException(422, "No text could be extracted from the image.")

    return {
        "filename": file.filename,
        "text": text,
        "word_count": len(text.split()),
        "confidence_estimate": 0.85,
    }


# ── POST /api/geo/ner ──────────────────────────────────────────────────────────

class NERRequest(BaseModel):
    text: str


@app.post("/api/geo/ner")
async def extract_entities(body: NERRequest):
    """
    NER endpoint: extract structured fields from OCR text using regex + RapidFuzz.
    Extracts: survey number, plot number, owner name, area, land use, village, district.
    """
    import re
    from rapidfuzz import fuzz

    text = body.text
    entities = []

    survey_match = re.search(
        r'(?:survey\s*no\.?|s\.no\.?|khasra\s*no\.?|gut\s*no\.?|gat\s*no\.?|plot\s*no\.?|field\s*no\.?)\s*:?\s*([A-Za-z0-9/\-]+(?:\s*[A-Za-z0-9/\-]+)*)',
        text, re.IGNORECASE
    )
    if survey_match:
        entities.append({
            "type": "SURVEY_NO",
            "value": survey_match.group(1).strip(),
            "confidence": 0.95,
            "source": "regex",
        })

    plot_match = re.search(
        r'(?:plot\s*no\.?|plot)\s*:?\s*([A-Za-z0-9/\-]+)',
        text, re.IGNORECASE
    )
    if plot_match:
        entities.append({
            "type": "PLOT_NO",
            "value": plot_match.group(1).strip(),
            "confidence": 0.90,
            "source": "regex",
        })

    owner_match = re.search(
        r'(?:owner|name|patta|holder)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
        text, re.IGNORECASE
    )
    if owner_match:
        entities.append({
            "type": "OWNER_NAME",
            "value": owner_match.group(1).strip(),
            "confidence": 0.80,
            "source": "regex",
        })

    area_match = re.search(
        r'(\d+(?:\.\d+)?)\s*(?:sq\.?\s*m|sqm|square\s*meters?|hectares?|ha|acres?)',
        text, re.IGNORECASE
    )
    if area_match:
        entities.append({
            "type": "AREA",
            "value": area_match.group(1),
            "unit": area_match.group(0).split()[-1],
            "confidence": 0.90,
            "source": "regex",
        })

    village_match = re.search(
        r'(?:village|gram|mouza)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})',
        text, re.IGNORECASE
    )
    if village_match:
        entities.append({
            "type": "VILLAGE",
            "value": village_match.group(1).strip(),
            "confidence": 0.75,
            "source": "regex",
        })

    district_match = re.search(
        r'(?:district|dist\.?|zila)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})',
        text, re.IGNORECASE
    )
    if district_match:
        entities.append({
            "type": "DISTRICT",
            "value": district_match.group(1).strip(),
            "confidence": 0.75,
            "source": "regex",
        })

    land_use_match = re.search(
        r'(residential|commercial|agricultural|industrial|mixed|vacant)',
        text, re.IGNORECASE
    )
    if land_use_match:
        entities.append({
            "type": "LAND_USE",
            "value": land_use_match.group(1).lower(),
            "confidence": 0.85,
            "source": "regex",
        })

    return {
        "entities": entities,
        "entity_count": len(entities),
        "summary": {
            "survey_number": next((e["value"] for e in entities if e["type"] == "SURVEY_NO"), None),
            "plot_number": next((e["value"] for e in entities if e["type"] == "PLOT_NO"), None),
            "owner_name": next((e["value"] for e in entities if e["type"] == "OWNER_NAME"), None),
            "area": next((e["value"] for e in entities if e["type"] == "AREA"), None),
            "village": next((e["value"] for e in entities if e["type"] == "VILLAGE"), None),
            "district": next((e["value"] for e in entities if e["type"] == "DISTRICT"), None),
            "land_use": next((e["value"] for e in entities if e["type"] == "LAND_USE"), None),
        },
    }


# ── POST /api/geo/datasets/upload ─────────────────────────────────────────────

@app.post("/api/geo/datasets/upload")
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_type: str = Form(...),
    declared_crs: Optional[str] = Form(None),
    uploaded_by: Optional[str] = Form(None),
):
    """
    Upload a vector dataset (GeoJSON, GeoPackage, Shapefile zip).
    - Detects/reads CRS, transforms to EPSG:4326
    - Logs CRS transformation in dataset_metadata — never silent (PRD §6.1)
    - Returns dataset_metadata row
    """
    ALLOWED_EXTENSIONS = {".geojson", ".json", ".gpkg", ".zip", ".shp"}
    suffix = Path(file.filename or "upload.geojson").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {suffix}. Allowed: {ALLOWED_EXTENSIONS}")

    VALID_SOURCE_TYPES = {
        "drone_ori", "dsm_dtm", "cadastral", "revenue",
        "municipal", "utility", "gnss", "building_footprint"
    }
    if source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(400, f"Invalid source_type. Must be one of: {VALID_SOURCE_TYPES}")

    # Save to local storage
    dataset_id = str(uuid.uuid4())
    storage_dir = STORAGE_PATH / dataset_id
    storage_dir.mkdir(parents=True)
    file_path = storage_dir / (file.filename or f"upload{suffix}")

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Process: CRS detection + topology validation
    try:
        from pipeline import load_geodataframe
        gdf, crs_result, validation_report = load_geodataframe(
            str(file_path), declared_crs=declared_crs
        )
    except Exception as e:
        logger.error(f"Failed to process upload {dataset_id}: {e}")
        raise HTTPException(422, f"Could not process file: {str(e)}")

    # Insert dataset_metadata
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                """
                INSERT INTO dataset_metadata (
                    id, source_type, original_filename, source_crs, target_crs,
                    transformation_method, feature_count, uploaded_by, storage_path,
                    validation_report
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    dataset_id,
                    source_type,
                    file.filename,
                    crs_result.source_crs,
                    "EPSG:4326",
                    crs_result.method,
                    len(gdf),
                    uploaded_by,
                    str(file_path),
                    json.dumps(validation_report.to_dict()),
                ),
            )
            row = dict(cur.fetchone())

    return {
        "dataset_id": dataset_id,
        "metadata": row,
        "validation_summary": validation_report.to_dict(),
        "feature_count": len(gdf),
        "crs_transformation": {
            "source_crs": crs_result.source_crs,
            "target_crs": "EPSG:4326",
            "method": crs_result.method,
        },
    }


# ── GET /api/geo/datasets/{id}/validation ─────────────────────────────────────

@app.get("/api/geo/datasets/{dataset_id}/validation")
async def get_dataset_validation(dataset_id: str):
    """Return the geometry/CRS validation report for a dataset."""
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                "SELECT * FROM dataset_metadata WHERE id = %s", (dataset_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, f"Dataset {dataset_id} not found")
            return dict(row)


# ── POST /api/geo/datasets/{id}/harmonize ─────────────────────────────────────

@app.post("/api/geo/datasets/{dataset_id}/harmonize")
async def harmonize_dataset(
    dataset_id: str,
    state: str = Query(default="UNK"),
    district: str = Query(default="UNK"),
    ulb: str = Query(default="UNK"),
    ward: str = Query(default="UNK"),
):
    """
    Run the full matching + confidence scoring pipeline for a dataset.
    - Loads the uploaded file
    - Converts features to ParcelCandidate objects
    - Inserts new parcels into urban_parcel
    - Matches against existing parcels
    - Writes conflicts to spatial_conflicts with score_reasons
    """
    # Fetch dataset metadata
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute("SELECT * FROM dataset_metadata WHERE id = %s", (dataset_id,))
            meta = cur.fetchone()
            if not meta:
                raise HTTPException(404, f"Dataset {dataset_id} not found")
            meta = dict(meta)

    file_path = meta["storage_path"]

    try:
        from pipeline import load_geodataframe, gdf_to_parcel_candidates, find_candidate_matches, generate_parcel_uid
        from shapely.geometry import mapping
        gdf, crs_result, _ = load_geodataframe(file_path)
    except Exception as e:
        raise HTTPException(422, f"Could not reload dataset: {str(e)}")

    new_candidates = gdf_to_parcel_candidates(
        gdf,
        source_type=meta["source_type"],
        source_dataset_id=dataset_id,
        state=state,
        district=district,
        ulb=ulb,
        ward=ward,
    )

    conflicts_created = []
    parcels_inserted = 0

    with get_db() as conn:
        with get_cursor(conn) as cur:
            # Load existing parcels for matching
            cur.execute(
                """
                SELECT parcel_uid, ST_AsGeoJSON(geometry)::json as geometry,
                       survey_number, plot_number, property_id,
                       owner_name, owner_name_normalized,
                       source_system as source_type,
                       recorded_area_sqm, created_at
                FROM urban_parcel
                WHERE superseded_by IS NULL
                """
            )
            from scoring import ParcelCandidate
            existing_rows = cur.fetchall()
            existing_parcels = []
            for r in existing_rows:
                r = dict(r)
                existing_parcels.append(ParcelCandidate(
                    parcel_uid=r["parcel_uid"],
                    geometry=r["geometry"],
                    survey_number=r.get("survey_number"),
                    plot_number=r.get("plot_number"),
                    property_id=r.get("property_id"),
                    owner_name=r.get("owner_name"),
                    owner_name_normalized=r.get("owner_name_normalized"),
                    source_type=r.get("source_type") or "cadastral",
                    recorded_area_sqm=r.get("recorded_area_sqm"),
                    created_at=r.get("created_at") or datetime.now(timezone.utc),
                ))

    with get_db() as conn:
        with get_cursor(conn) as cur:
            for new_p in new_candidates:
                # Find matches and score before insertion
                matches = find_candidate_matches(new_p, existing_parcels)
                top_score = matches[0][1].score if matches else 0.0
                initial_status = "auto_linked" if top_score >= settings.auto_link_threshold else "unverified"

                # Compute area
                import math
                from shapely.geometry import shape as shp
                geom = shp(new_p.geometry)
                centroid_lat = geom.centroid.y
                deg_to_m = 111320.0 * math.cos(math.radians(centroid_lat))
                area_sqm = geom.area * deg_to_m ** 2

                cur.execute(
                    """
                    INSERT INTO urban_parcel (
                        parcel_uid, geometry, survey_number, plot_number, property_id,
                        owner_name, owner_name_normalized, geometry_area_sqm,
                        source_system, source_dataset_id, validation_status, version
                    )
                    VALUES (
                        %s, ST_GeomFromGeoJSON(%s), %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, 1
                    )
                    ON CONFLICT (parcel_uid) DO NOTHING
                    """,
                    (
                        new_p.parcel_uid,
                        json.dumps(new_p.geometry),
                        new_p.survey_number,
                        new_p.plot_number,
                        new_p.property_id,
                        new_p.owner_name,
                        new_p.owner_name_normalized,
                        round(area_sqm, 2),
                        meta["source_type"],
                        dataset_id,
                        initial_status,
                    ),
                )
                parcels_inserted += 1

                for existing_p, score_result in matches[:3]:  # top 3 candidates
                    diff_geojson = json.dumps(score_result.geometry_diff) if score_result.geometry_diff else None
                    if diff_geojson:
                        cur.execute(
                            """
                            INSERT INTO spatial_conflicts (
                                parcel_uid_a, parcel_uid_b, conflict_type,
                                geometry_diff, difference_value, confidence_score,
                                score_reasons, recommended_action, status
                            ) VALUES (
                                %s, %s, %s,
                                ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326),
                                %s, %s,
                                %s::jsonb, %s, 'open'
                            )
                            RETURNING conflict_id
                            """,
                            (
                                new_p.parcel_uid,
                                existing_p.parcel_uid,
                                score_result.conflict_type,
                                diff_geojson,
                                score_result.difference_value,
                                round(score_result.score, 4),
                                json.dumps([r.to_dict() for r in score_result.score_reasons]),
                                score_result.recommended_action,
                            ),
                        )
                    else:
                        cur.execute(
                            """
                            INSERT INTO spatial_conflicts (
                                parcel_uid_a, parcel_uid_b, conflict_type,
                                geometry_diff, difference_value, confidence_score,
                                score_reasons, recommended_action, status
                            ) VALUES (
                                %s, %s, %s,
                                NULL,
                                %s, %s,
                                %s::jsonb, %s, 'open'
                            )
                            RETURNING conflict_id
                            """,
                            (
                                new_p.parcel_uid,
                                existing_p.parcel_uid,
                                score_result.conflict_type,
                                score_result.difference_value,
                                round(score_result.score, 4),
                                json.dumps([r.to_dict() for r in score_result.score_reasons]),
                                score_result.recommended_action,
                            ),
                        )
                    row = cur.fetchone()
                    conflicts_created.append({
                        "conflict_id": str(row["conflict_id"]),
                        "score": round(score_result.score, 4),
                        "recommended_action": score_result.recommended_action,
                        "parcel_uid_a": new_p.parcel_uid,
                        "parcel_uid_b": existing_p.parcel_uid,
                    })

    return {
        "dataset_id": dataset_id,
        "parcels_processed": len(new_candidates),
        "parcels_inserted": parcels_inserted,
        "conflicts_generated": len(conflicts_created),
        "auto_linked": sum(1 for c in conflicts_created if c["recommended_action"] == "auto_merge"),
        "flagged_for_review": sum(1 for c in conflicts_created if c["recommended_action"] == "human_review"),
        "conflicts": conflicts_created,
    }


# ── GET /api/geo/parcels ──────────────────────────────────────────────────────

@app.get("/api/geo/parcels")
async def list_parcels(
    status: Optional[str] = Query(None),
    bbox: Optional[str] = Query(None, description="minx,miny,maxx,maxy in EPSG:4326"),
    dataset_id: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
):
    """List parcels, filterable by status, bounding box, or source dataset."""
    conditions = ["superseded_by IS NULL"]
    params = []

    if status:
        conditions.append(f"validation_status = %s")
        params.append(status)
    if dataset_id:
        conditions.append("source_dataset_id = %s")
        params.append(dataset_id)
    if bbox:
        try:
            minx, miny, maxx, maxy = map(float, bbox.split(","))
            conditions.append(
                "geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)"
            )
            params.extend([minx, miny, maxx, maxy])
        except ValueError:
            raise HTTPException(400, "bbox must be: minx,miny,maxx,maxy")

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    params_with_limit = params + [limit, offset]

    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(f"SELECT COUNT(*) FROM urban_parcel {where}", params)
            total = cur.fetchone()["count"]

            cur.execute(
                f"""
                SELECT parcel_uid, ulpin, ST_AsGeoJSON(geometry)::json as geometry,
                       survey_number, plot_number, property_id,
                       owner_name, recorded_area_sqm, geometry_area_sqm,
                       land_use, source_system, validation_status, version, created_at
                FROM urban_parcel {where}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                params_with_limit,
            )
            rows = [dict(r) for r in cur.fetchall()]

    return {"total": total, "limit": limit, "offset": offset, "parcels": rows}


# ── GET /api/geo/parcels/{parcel_uid} ─────────────────────────────────────────

@app.get("/api/geo/parcels/{parcel_uid}")
async def get_parcel(parcel_uid: str):
    """Get full parcel detail including version history."""
    with get_db() as conn:
        with get_cursor(conn) as cur:
            # Current version
            cur.execute(
                """
                SELECT parcel_uid, ulpin, ST_AsGeoJSON(geometry)::json as geometry,
                       survey_number, plot_number, property_id,
                       owner_name, owner_name_normalized, recorded_area_sqm, geometry_area_sqm,
                       land_use, source_system, source_dataset_id,
                       geometry_confidence, attribute_confidence,
                       validation_status, version, superseded_by, created_at
                FROM urban_parcel WHERE parcel_uid = %s
                """,
                (parcel_uid,),
            )
            parcel = cur.fetchone()
            if not parcel:
                raise HTTPException(404, f"Parcel {parcel_uid} not found")
            parcel = dict(parcel)

            # Version history (all rows sharing this uid chain)
            cur.execute(
                """
                SELECT parcel_uid, version, validation_status, created_at, superseded_by
                FROM urban_parcel
                WHERE parcel_uid = %s OR superseded_by = %s
                ORDER BY version ASC
                """,
                (parcel_uid, parcel_uid),
            )
            history = [dict(r) for r in cur.fetchall()]

            # Related conflicts
            cur.execute(
                """
                SELECT conflict_id, parcel_uid_a, parcel_uid_b, conflict_type,
                       confidence_score, score_reasons, recommended_action, status, created_at
                FROM spatial_conflicts
                WHERE parcel_uid_a = %s OR parcel_uid_b = %s
                ORDER BY created_at DESC
                """,
                (parcel_uid, parcel_uid),
            )
            conflicts = [dict(r) for r in cur.fetchall()]

    return {"parcel": parcel, "version_history": history, "conflicts": conflicts}


# ── GET /api/geo/conflicts ────────────────────────────────────────────────────

@app.get("/api/geo/conflicts")
async def list_conflicts(
    status: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None),
    max_score: Optional[float] = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0),
):
    """List spatial conflicts, filterable by status and confidence score range."""
    conditions = []
    params = []

    if status:
        conditions.append("status = %s")
        params.append(status)
    if min_score is not None:
        conditions.append("confidence_score >= %s")
        params.append(min_score)
    if max_score is not None:
        conditions.append("confidence_score <= %s")
        params.append(max_score)

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    params_count = params[:]
    params_page = params + [limit, offset]

    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(f"SELECT COUNT(*) FROM spatial_conflicts {where}", params_count)
            total = cur.fetchone()["count"]

            cur.execute(
                f"""
                SELECT
                    c.conflict_id, c.parcel_uid_a, c.parcel_uid_b,
                    c.conflict_type, c.difference_value,
                    c.confidence_score, c.score_reasons, c.recommended_action,
                    c.status, c.assigned_to, c.created_at, c.resolved_at,
                    a.survey_number as survey_a, a.owner_name as owner_a,
                    b.survey_number as survey_b, b.owner_name as owner_b,
                    ST_AsGeoJSON(a.geometry)::json as geometry_a,
                    ST_AsGeoJSON(b.geometry)::json as geometry_b,
                    ST_AsGeoJSON(c.geometry_diff)::json as geometry_diff
                FROM spatial_conflicts c
                LEFT JOIN urban_parcel a ON a.parcel_uid = c.parcel_uid_a
                LEFT JOIN urban_parcel b ON b.parcel_uid = c.parcel_uid_b
                {where}
                ORDER BY c.created_at DESC
                LIMIT %s OFFSET %s
                """,
                params_page,
            )
            rows = [dict(r) for r in cur.fetchall()]

    return {"total": total, "limit": limit, "offset": offset, "conflicts": rows}


# ── POST /api/geo/conflicts/{id}/decision ─────────────────────────────────────

@app.post("/api/geo/conflicts/{conflict_id}/decision")
async def record_conflict_decision(conflict_id: str, body: ConflictDecisionBody):
    """
    Record a human review decision on a conflict.
    - Updates conflict status
    - If approved: updates parcel validation_status (inserts new version per append-only rule)
    - Every decision must be logged in gh_audit_log by the caller (web app writes audit log)
    """
    valid_actions = {"approve_match", "reject_match", "field_verification_required"}
    if body.action not in valid_actions:
        raise HTTPException(400, f"Invalid action. Must be one of: {valid_actions}")

    with get_db() as conn:
        with get_cursor(conn) as cur:
            # Fetch current conflict state
            cur.execute(
                "SELECT * FROM spatial_conflicts WHERE conflict_id = %s",
                (conflict_id,),
            )
            conflict = cur.fetchone()
            if not conflict:
                raise HTTPException(404, f"Conflict {conflict_id} not found")
            conflict = dict(conflict)

            if conflict["status"] != "open":
                raise HTTPException(409, f"Conflict is already resolved (status: {conflict['status']})")

            # Map action to status
            status_map = {
                "approve_match": "approved",
                "reject_match": "rejected",
                "field_verification_required": "field_verification_required",
            }
            new_status = status_map[body.action]

            # Update conflict
            cur.execute(
                """
                UPDATE spatial_conflicts
                SET status = %s, assigned_to = %s, resolved_at = NOW()
                WHERE conflict_id = %s
                """,
                (new_status, body.actor_id, conflict_id),
            )

            # If approved: version the parcel (append-only per PRD §4.2)
            # Insert new row with version+1 and validation_status='human_approved',
            # then set superseded_by on the old row.
            if body.action == "approve_match":
                cur.execute(
                    "SELECT version FROM urban_parcel WHERE parcel_uid = %s",
                    (conflict["parcel_uid_a"],),
                )
                old_row = cur.fetchone()
                if old_row:
                    current_ver = old_row.get("version") or 1
                    new_ver = current_ver + 1
                    base_uid = conflict["parcel_uid_a"].split("-v")[0]
                    new_uid = f"{base_uid}-v{new_ver}"
                    cur.execute(
                        """
                        INSERT INTO urban_parcel (
                            parcel_uid, ulpin, geometry, survey_number, plot_number,
                            property_id, owner_name, owner_name_normalized,
                            recorded_area_sqm, geometry_area_sqm, land_use,
                            source_system, source_dataset_id, geometry_confidence,
                            attribute_confidence, validation_status, version
                        )
                        SELECT
                            %s, ulpin, geometry, survey_number, plot_number,
                            property_id, owner_name, owner_name_normalized,
                            recorded_area_sqm, geometry_area_sqm, land_use,
                            source_system, source_dataset_id, geometry_confidence,
                            attribute_confidence, 'human_approved', %s
                        FROM urban_parcel WHERE parcel_uid = %s
                        ON CONFLICT (parcel_uid) DO NOTHING
                        """,
                        (new_uid, new_ver, conflict["parcel_uid_a"]),
                    )
                    cur.execute(
                        "UPDATE urban_parcel SET superseded_by = %s WHERE parcel_uid = %s",
                        (new_uid, conflict["parcel_uid_a"]),
                    )

    return {
        "conflict_id": conflict_id,
        "new_status": new_status,
        "actor_id": body.actor_id,
        "notes": body.notes,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }


# ── POST /api/geo/datasets/{id}/compare ────────────────────────────────────────

@app.post("/api/geo/datasets/{dataset_id}/compare")
async def compare_datasets(
    dataset_id: str,
    compare_to: str = Query(..., description="Dataset ID to compare against"),
):
    """
    Run change detection between two dataset vintages.
    Compares the dataset with ID `dataset_id` against `compare_to`.
    Writes results to change_events table.
    """
    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute("SELECT * FROM dataset_metadata WHERE id = %s", (dataset_id,))
            new_meta = cur.fetchone()
            if not new_meta:
                raise HTTPException(404, f"Dataset {dataset_id} not found")
            new_meta = dict(new_meta)

            cur.execute("SELECT * FROM dataset_metadata WHERE id = %s", (compare_to,))
            old_meta = cur.fetchone()
            if not old_meta:
                raise HTTPException(404, f"Comparison dataset {compare_to} not found")
            old_meta = dict(old_meta)

    try:
        from pipeline import load_geodataframe, detect_changes
        old_gdf, _, _ = load_geodataframe(old_meta["storage_path"])
        new_gdf, _, _ = load_geodataframe(new_meta["storage_path"])
    except Exception as e:
        raise HTTPException(422, f"Could not load datasets: {str(e)}")

    changes = detect_changes(
        old_gdf, new_gdf,
        old_dataset_id=str(old_meta["id"]),
        new_dataset_id=str(new_meta["id"]),
    )

    with get_db() as conn:
        with get_cursor(conn) as cur:
            for change in changes:
                cur.execute(
                    """
                    INSERT INTO change_events (
                        parcel_uid, change_type, detected_from_dataset_id,
                        compared_to_dataset_id, confidence, area_delta_sqm,
                        description, requires_verification
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        change["parcel_uid"],
                        change["change_type"],
                        change["detected_from_dataset_id"],
                        change["compared_to_dataset_id"],
                        change["confidence"],
                        change["area_delta_sqm"],
                        change["description"],
                        change["requires_verification"],
                    ),
                )

    return {
        "dataset_id": dataset_id,
        "compared_to": compare_to,
        "changes_detected": len(changes),
        "changes": changes,
    }


# ── GET /api/geo/changes ──────────────────────────────────────────────────────

@app.get("/api/geo/changes")
async def list_changes(
    requires_verification: Optional[bool] = Query(None),
    change_type: Optional[str] = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0),
):
    """List detected change events. All labeled 'verification required' — never accusatory."""
    conditions = []
    params = []

    if requires_verification is not None:
        conditions.append("requires_verification = %s")
        params.append(requires_verification)
    if change_type:
        conditions.append("change_type = %s")
        params.append(change_type)

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    params_page = params + [limit, offset]

    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(f"SELECT COUNT(*) FROM change_events {where}", params)
            total = cur.fetchone()["count"]

            cur.execute(
                f"""
                SELECT id, parcel_uid, change_type, detected_from_dataset_id,
                       compared_to_dataset_id, confidence, area_delta_sqm,
                       description, requires_verification, created_at
                FROM change_events {where}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                params_page,
            )
            rows = [dict(r) for r in cur.fetchall()]

    return {"total": total, "limit": limit, "offset": offset, "changes": rows}


# ── GET /api/geo/export/geojson ───────────────────────────────────────────────

@app.get("/api/geo/export/geojson")
async def export_geojson(
    status: Optional[str] = Query(None),
    dataset_id: Optional[str] = Query(None),
):
    """Export harmonized parcels as a valid GeoJSON FeatureCollection."""
    conditions = ["superseded_by IS NULL", "geometry IS NOT NULL"]
    params = []

    if status:
        conditions.append("validation_status = %s")
        params.append(status)
    if dataset_id:
        conditions.append("source_dataset_id = %s")
        params.append(dataset_id)

    where = "WHERE " + " AND ".join(conditions)

    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                f"""
                SELECT parcel_uid, ulpin, ST_AsGeoJSON(geometry)::json as geometry,
                       survey_number, plot_number, property_id,
                       owner_name, recorded_area_sqm, geometry_area_sqm,
                       land_use, source_system, validation_status, version, created_at
                FROM urban_parcel {where}
                ORDER BY created_at DESC
                """,
                params,
            )
            rows = [dict(r) for r in cur.fetchall()]

    features = []
    for row in rows:
        geom = row.pop("geometry", None)
        # Convert datetime to string
        for k, v in row.items():
            if isinstance(v, datetime):
                row[k] = v.isoformat()
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": row,
        })

    geojson = {"type": "FeatureCollection", "features": features}

    # Write to temp file and return
    tmp_path = STORAGE_PATH / f"export_{uuid.uuid4()}.geojson"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, default=str)

    return FileResponse(
        str(tmp_path),
        media_type="application/geo+json",
        filename="geosync_export.geojson",
    )


# ── GET /api/geo/export/geopackage ───────────────────────────────────────────

@app.get("/api/geo/export/geopackage")
async def export_geopackage(
    status: Optional[str] = Query(None),
    dataset_id: Optional[str] = Query(None),
):
    """Export harmonized parcels as a GeoPackage (openable in QGIS)."""
    import geopandas as gpd
    from shapely.geometry import shape

    conditions = ["superseded_by IS NULL", "geometry IS NOT NULL"]
    params = []

    if status:
        conditions.append("validation_status = %s")
        params.append(status)
    if dataset_id:
        conditions.append("source_dataset_id = %s")
        params.append(dataset_id)

    where = "WHERE " + " AND ".join(conditions)

    with get_db() as conn:
        with get_cursor(conn) as cur:
            cur.execute(
                f"""
                SELECT parcel_uid, ulpin, ST_AsGeoJSON(geometry)::json as geometry,
                       survey_number, plot_number, property_id,
                       owner_name, recorded_area_sqm, geometry_area_sqm,
                       land_use, source_system, validation_status, version, created_at
                FROM urban_parcel {where}
                """,
                params,
            )
            rows = [dict(r) for r in cur.fetchall()]

    if not rows:
        raise HTTPException(404, "No parcels found matching the filter criteria")

    # Build GeoDataFrame
    geometries = [shape(r.pop("geometry")) for r in rows]
    for row in rows:
        for k, v in row.items():
            if isinstance(v, datetime):
                row[k] = v.isoformat()

    gdf = gpd.GeoDataFrame(rows, geometry=geometries, crs="EPSG:4326")

    tmp_path = STORAGE_PATH / f"export_{uuid.uuid4()}.gpkg"
    gdf.to_file(str(tmp_path), driver="GPKG", layer="parcels")

    return FileResponse(
        str(tmp_path),
        media_type="application/geopackage+sqlite3",
        filename="geosync_export.gpkg",
    )


# ── Startup / Shutdown ────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    logger.info("GeoSync Geo Engine starting up")
    # Verify DB connection
    try:
        with get_db() as conn:
            with get_cursor(conn) as cur:
                cur.execute("SELECT PostGIS_Version()")
                version = cur.fetchone()
                logger.info(f"PostGIS connected: {dict(version)}")
    except Exception as e:
        logger.error(f"DB connection failed on startup: {e}")


@app.on_event("shutdown")
async def shutdown():
    from database import close_pool
    close_pool()
    logger.info("GeoSync Geo Engine shutting down")
