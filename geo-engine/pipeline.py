"""
GeoHarmonize — Geospatial Processing Pipeline
Handles CRS detection, transformation, topology validation, and spatial matching.

PRD §6 features implemented here:
  §6.1 — CRS detection & transformation (always logged, never silent)
  §6.2 — Geometry validation & topology correction (ST_MakeValid equivalent)
  §6.3 — Spatial matching engine (bounding-box + ST_DWithin, then IoU scoring)
"""

from __future__ import annotations
import json
import hashlib
import re
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone
import logging

import geopandas as gpd
from shapely.geometry import shape, mapping
from shapely.validation import make_valid
from pyproj import CRS, Transformer
import numpy as np

from scoring import ParcelCandidate, score_candidate_pair, ScoringResult, normalize_name

logger = logging.getLogger(__name__)


# ── ULPIN / parcel UID generation ─────────────────────────────────────────────

def generate_parcel_uid(
    state: str,
    district: str,
    ulb: str,
    ward: str,
    geometry: dict,
) -> str:
    """
    Generate a unique parcel UID per format: IN-{STATE}-{DISTRICT}-{ULB}-{WARD}-{HASH}
    HASH is the first 8 chars of SHA256 of the WKT centroid string.
    """
    centroid = shape(geometry).centroid
    hash_input = f"{centroid.x:.6f},{centroid.y:.6f}"
    geohash = hashlib.sha256(hash_input.encode()).hexdigest()[:8].upper()

    parts = [
        "IN",
        re.sub(r"\W", "", state.upper())[:6],
        re.sub(r"\W", "", district.upper())[:6],
        re.sub(r"\W", "", ulb.upper())[:6],
        re.sub(r"\W", "", ward.upper())[:4],
        geohash,
    ]
    return "-".join(parts)


# ── CRS detection & transformation ───────────────────────────────────────────

class CRSTransformResult:
    def __init__(self, gdf: gpd.GeoDataFrame, source_crs: str, method: str):
        self.gdf = gdf
        self.source_crs = source_crs
        self.method = method


def detect_and_transform(
    gdf: gpd.GeoDataFrame,
    declared_crs: Optional[str] = None,
) -> CRSTransformResult:
    """
    Detect the CRS of a GeoDataFrame, transform to EPSG:4326.
    Always logs the source CRS and transformation method — never transforms silently.

    Args:
        gdf: Input GeoDataFrame (may or may not have CRS set)
        declared_crs: If the user declared a CRS in the upload form, use it

    Returns:
        CRSTransformResult with transformed GDF, source_crs string, and method description
    """
    # Determine source CRS
    if declared_crs:
        try:
            source = CRS.from_user_input(declared_crs)
            gdf = gdf.set_crs(source, allow_override=True)
            method = f"user_declared:{declared_crs}"
            logger.info(f"CRS set from user declaration: {declared_crs}")
        except Exception as e:
            logger.warning(f"User-declared CRS '{declared_crs}' invalid: {e}. Falling back to detected CRS.")
            method = "detection_fallback"
    elif gdf.crs is not None:
        source = gdf.crs
        method = f"read_from_file:{source.to_epsg() or source.to_string()}"
        logger.info(f"CRS detected from file: {source}")
    else:
        # No CRS information — assume EPSG:4326 but flag it
        source = CRS.from_epsg(4326)
        gdf = gdf.set_crs(source)
        method = "assumed_epsg4326_no_crs_in_file"
        logger.warning("No CRS found in file. Assuming EPSG:4326. Verify this is correct!")

    source_crs_str = gdf.crs.to_string()

    # Transform to EPSG:4326 if not already
    target = CRS.from_epsg(4326)
    if gdf.crs != target:
        gdf = gdf.to_crs(target)
        method += "->EPSG:4326"
        logger.info(f"Transformed from {source_crs_str} to EPSG:4326")

    return CRSTransformResult(gdf=gdf, source_crs=source_crs_str, method=method)


# ── Geometry validation & topology correction ─────────────────────────────────

class ValidationReport:
    def __init__(self):
        self.total_features: int = 0
        self.invalid_count: int = 0
        self.repaired_count: int = 0
        self.slivers: list[str] = []        # parcel UIDs with sliver area
        self.gaps: list[dict] = []          # detected gap polygons
        self.overlaps: list[dict] = []      # detected overlap polygons
        self.errors: list[str] = []

    def to_dict(self) -> dict:
        return {
            "total_features": self.total_features,
            "invalid_count": self.invalid_count,
            "repaired_count": self.repaired_count,
            "sliver_count": len(self.slivers),
            "gap_count": len(self.gaps),
            "overlap_count": len(self.overlaps),
            "errors": self.errors,
        }


SLIVER_THRESHOLD_SQM = 10.0  # polygons smaller than 10 sqm are slivers


def validate_and_repair_topology(gdf: gpd.GeoDataFrame) -> tuple[gpd.GeoDataFrame, ValidationReport]:
    """
    Run topology validation and repair.
    - Calls make_valid() on invalid geometries (Shapely equivalent of ST_MakeValid)
    - Detects slivers (area < SLIVER_THRESHOLD_SQM)
    - Logs all issues in ValidationReport

    Returns repaired GeoDataFrame and the validation report.
    """
    import math
    report = ValidationReport()
    report.total_features = len(gdf)

    repaired_geoms = []
    for idx, geom in enumerate(gdf.geometry):
        if geom is None:
            report.errors.append(f"Feature {idx}: null geometry")
            repaired_geoms.append(geom)
            continue

        if not geom.is_valid:
            report.invalid_count += 1
            repaired = make_valid(geom)
            report.repaired_count += 1
            logger.info(f"Feature {idx}: repaired invalid geometry ({geom.geom_type})")
            repaired_geoms.append(repaired)
        else:
            repaired_geoms.append(geom)

        # Sliver detection (rough sqm estimate)
        centroid_lat = geom.centroid.y if geom else 0
        deg_to_m = 111320.0 * math.cos(math.radians(centroid_lat))
        area_sqm = geom.area * deg_to_m ** 2 if geom else 0

        if 0 < area_sqm < SLIVER_THRESHOLD_SQM:
            report.slivers.append(str(idx))
            logger.warning(f"Feature {idx}: sliver detected ({area_sqm:.2f} sqm)")

    gdf = gdf.copy()
    gdf.geometry = repaired_geoms
    return gdf, report


# ── Parcel ingestion ───────────────────────────────────────────────────────────

def gdf_to_parcel_candidates(
    gdf: gpd.GeoDataFrame,
    source_type: str,
    source_dataset_id: str,
    state: str = "UNKNOWN",
    district: str = "UNKNOWN",
    ulb: str = "UNKNOWN",
    ward: str = "UNKNOWN",
) -> list[ParcelCandidate]:
    """Convert a validated, repaired GeoDataFrame to a list of ParcelCandidate objects."""
    candidates = []
    now = datetime.now(timezone.utc)

    for _, row in gdf.iterrows():
        geom = row.geometry
        if geom is None:
            continue

        geom_dict = mapping(geom)
        parcel_uid = generate_parcel_uid(state, district, ulb, ward, geom_dict)

        # Extract common attribute fields (column names vary by source)
        def get_field(*keys: str) -> Optional[str]:
            for k in keys:
                v = row.get(k) or row.get(k.lower()) or row.get(k.upper())
                if v and str(v).strip() and str(v).lower() not in ("nan", "none", "null"):
                    return str(v).strip()
            return None

        owner_name = get_field("owner_name", "owner", "Owner_Name", "OWNER", "occupant_name")
        survey_number = get_field("survey_number", "survey_no", "Survey_No", "SURVEY_NO", "svy_no")
        plot_number = get_field("plot_number", "plot_no", "Plot_No", "PLOT_NO")
        property_id = get_field("property_id", "prop_id", "PROPERTY_ID")

        candidates.append(ParcelCandidate(
            parcel_uid=parcel_uid,
            geometry=geom_dict,
            survey_number=survey_number,
            plot_number=plot_number,
            property_id=property_id,
            owner_name=owner_name,
            owner_name_normalized=normalize_name(owner_name),
            source_type=source_type,
            recorded_area_sqm=None,
            created_at=now,
        ))

    return candidates


# ── Spatial matching engine ───────────────────────────────────────────────────

def find_candidate_matches(
    new_parcel: ParcelCandidate,
    existing_parcels: list[ParcelCandidate],
    distance_threshold_deg: float = 0.001,  # ~111m at equator
) -> list[tuple[ParcelCandidate, ScoringResult]]:
    """
    Find candidate matches from existing parcels for a new parcel.

    Step 1: Bounding-box filter (fast prefilter)
    Step 2: Distance check (ST_DWithin equivalent using Shapely)
    Step 3: Score surviving candidates with the confidence formula

    Returns list of (existing_parcel, scoring_result) tuples, sorted by score descending.
    """
    new_geom = shape(new_parcel.geometry)
    new_bounds = new_geom.bounds  # (minx, miny, maxx, maxy)

    matches = []

    for existing in existing_parcels:
        ex_geom = shape(existing.geometry)
        ex_bounds = ex_geom.bounds

        # Bounding-box overlap prefilter
        if (new_bounds[2] < ex_bounds[0] - distance_threshold_deg or
                new_bounds[0] > ex_bounds[2] + distance_threshold_deg or
                new_bounds[3] < ex_bounds[1] - distance_threshold_deg or
                new_bounds[1] > ex_bounds[3] + distance_threshold_deg):
            continue

        # Distance check
        try:
            dist = new_geom.distance(ex_geom)
        except Exception:
            continue

        if dist > distance_threshold_deg:
            continue

        # Score the pair
        result = score_candidate_pair(new_parcel, existing)
        matches.append((existing, result))

    # Sort by confidence score descending
    matches.sort(key=lambda x: x[1].score, reverse=True)
    return matches


# ── File loading ──────────────────────────────────────────────────────────────

def load_geodataframe(file_path: str, declared_crs: Optional[str] = None) -> tuple[gpd.GeoDataFrame, CRSTransformResult, ValidationReport]:
    """
    Load a vector file (GeoJSON, GeoPackage, Shapefile) into a validated GeoDataFrame.
    Returns (gdf, crs_result, validation_report).
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    gdf = gpd.read_file(str(path))
    if len(gdf) == 0:
        raise ValueError(f"File contains no features: {file_path}")

    crs_result = detect_and_transform(gdf, declared_crs=declared_crs)
    gdf_repaired, report = validate_and_repair_topology(crs_result.gdf)
    crs_result.gdf = gdf_repaired

    return gdf_repaired, crs_result, report


# ── Change Detection (Two-Vintage Comparison) ──────────────────────────────────

def detect_changes(
    old_gdf: gpd.GeoDataFrame,
    new_gdf: gpd.GeoDataFrame,
    old_dataset_id: str,
    new_dataset_id: str,
    iou_threshold: float = 0.85,
    area_diff_threshold_pct: float = 10.0,
) -> list[dict]:
    """
    Compare two dataset vintages and detect changes.

    Returns list of change events with type, confidence, and description.
    All events are labeled 'verification required' — never accusatory.

    Change types:
    - boundary_shift: IoU below threshold (boundary drift)
    - subdivision: one old parcel intersects multiple new parcels
    - new_building: new parcel with no spatial match in old data
    - demolition: old parcel with no spatial match in new data
    """
    changes = []

    old_geoms = list(old_gdf.geometry)
    new_geoms = list(new_gdf.geometry)
    old_uids = list(old_gdf.get("parcel_uid", [f"old_{i}" for i in range(len(old_gdf))]))
    new_uids = list(new_gdf.get("parcel_uid", [f"new_{i}" for i in range(len(new_gdf))]))

    matched_old = set()
    matched_new = set()

    for o_idx, o_geom in enumerate(old_geoms):
        if o_geom is None or o_geom.is_empty:
            continue

        best_iou = 0.0
        best_n_idx = -1

        for n_idx, n_geom in enumerate(new_geoms):
            if n_geom is None or n_geom.is_empty:
                continue
            if n_idx in matched_new:
                continue

            try:
                intersection = o_geom.intersection(n_geom)
                union = o_geom.union(n_geom)
                if union.is_empty or union.area == 0:
                    continue
                iou = intersection.area / union.area
                if iou > best_iou:
                    best_iou = iou
                    best_n_idx = n_idx
            except Exception:
                continue

        if best_n_idx >= 0 and best_iou >= 0.3:
            matched_old.add(o_idx)
            matched_new.add(best_n_idx)

            if best_iou < iou_threshold:
                n_geom = new_geoms[best_n_idx]
                try:
                    sym_diff = o_geom.symmetric_difference(n_geom)
                    diff_area = sym_diff.area * (111320 ** 2)
                except Exception:
                    diff_area = 0

                confidence = min(1.0, (1.0 - best_iou) * 2)
                changes.append({
                    "parcel_uid": str(old_uids[o_idx]),
                    "change_type": "boundary_shift",
                    "detected_from_dataset_id": new_dataset_id,
                    "compared_to_dataset_id": old_dataset_id,
                    "confidence": round(confidence, 4),
                    "area_delta_sqm": round(diff_area, 2),
                    "description": f"Boundary shift detected (IoU: {best_iou:.1%}). Verification required.",
                    "requires_verification": True,
                })

    for o_idx, o_geom in enumerate(old_geoms):
        if o_idx in matched_old or o_geom is None or o_geom.is_empty:
            continue

        intersecting_new = []
        for n_idx, n_geom in enumerate(new_geoms):
            if n_geom is None or n_geom.is_empty:
                continue
            try:
                if o_geom.intersects(n_geom):
                    intersection = o_geom.intersection(n_geom)
                    if not intersection.is_empty:
                        intersecting_new.append((n_idx, intersection.area / o_geom.area))
            except Exception:
                continue

        if len(intersecting_new) > 1:
            new_ids = [str(new_uids[idx]) for idx, _ in intersecting_new]
            changes.append({
                "parcel_uid": str(old_uids[o_idx]),
                "change_type": "subdivision",
                "detected_from_dataset_id": new_dataset_id,
                "compared_to_dataset_id": old_dataset_id,
                "confidence": 0.85,
                "area_delta_sqm": 0,
                "description": f"Parcel subdivided into {len(intersecting_new)} new parcels. Verification required.",
                "requires_verification": True,
            })
            for n_idx, _ in intersecting_new:
                matched_new.add(n_idx)
        elif len(intersecting_new) == 0:
            changes.append({
                "parcel_uid": str(old_uids[o_idx]),
                "change_type": "demolition",
                "detected_from_dataset_id": new_dataset_id,
                "compared_to_dataset_id": old_dataset_id,
                "confidence": 0.70,
                "area_delta_sqm": 0,
                "description": "Parcel not found in new dataset. Possible demolition or removal. Verification required.",
                "requires_verification": True,
            })

    for n_idx, n_geom in enumerate(new_geoms):
        if n_idx in matched_new or n_geom is None or n_geom.is_empty:
            continue

        intersecting_old = []
        for o_idx, o_geom in enumerate(old_geoms):
            if o_geom is None or o_geom.is_empty:
                continue
            try:
                if n_geom.intersects(o_geom):
                    intersection = n_geom.intersection(o_geom)
                    if not intersection.is_empty:
                        intersecting_old.append((o_idx, intersection.area / n_geom.area))
            except Exception:
                continue

        if len(intersecting_old) == 0:
            changes.append({
                "parcel_uid": str(new_uids[n_idx]),
                "change_type": "new_building",
                "detected_from_dataset_id": new_dataset_id,
                "compared_to_dataset_id": old_dataset_id,
                "confidence": 0.75,
                "area_delta_sqm": 0,
                "description": "New parcel detected with no match in old dataset. Possible new construction. Verification required.",
                "requires_verification": True,
            })

    return changes


# ── Building Footprint Extraction (nDSM Method) ──────────────────────────────

def extract_building_footprints(
    dsm_path: str,
    dtm_path: str,
    threshold_m: float = 2.5,
    min_area_sqm: float = 10.0,
    simplify_tolerance: float = 0.5,
) -> tuple[list[dict], dict]:
    """
    Extract building footprints using the nDSM (normalized Digital Surface Model) method.

    Algorithm:
    1. Compute nDSM = DSM - DTM
    2. Threshold at ~2.5m (buildings are typically > 2.5m tall)
    3. Clean with morphological open/close
    4. Vectorize with rasterio.features.shapes
    5. Simplify geometries
    6. Filter by minimum area

    Returns:
        - List of footprint polygons with confidence values
        - Method metadata (always shown in UI/API)
    """
    import numpy as np
    import rasterio
    from rasterio.features import shapes
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union
    from scipy import ndimage

    method_info = {
        "method": "nDSM (DSM - DTM)",
        "threshold_m": threshold_m,
        "min_area_sqm": min_area_sqm,
        "simplify_tolerance": simplify_tolerance,
        "dsm_path": dsm_path,
        "dtm_path": dtm_path,
    }

    with rasterio.open(dsm_path) as dsm_src:
        dsm = dsm_src.read(1)
        dsm_transform = dsm_src.transform
        dsm_crs = dsm_src.crs
        dsm_nodata = dsm_src.nodata

    with rasterio.open(dtm_path) as dtm_src:
        dtm = dtm_src.read(1)
        dtm_nodata = dtm_src.nodata

    if dsm_nodata is not None:
        dsm = np.where(dsm == dsm_nodata, np.nan, dsm)
    if dtm_nodata is not None:
        dtm = np.where(dtm == dtm_nodata, np.nan, dtm)

    ndsm = dsm - dtm

    binary = (ndsm > threshold_m).astype(np.uint8)

    binary = ndimage.binary_opening(binary, structure=np.ones((3, 3)))
    binary = ndimage.binary_closing(binary, structure=np.ones((3, 3)))

    mask = binary.astype(bool)
    shapes_gen = shapes(mask, mask=mask, transform=dsm_transform)

    footprints = []
    for geom, val in shapes_gen:
        if val == 0:
            continue
        polygon = shape(geom)
        if polygon.is_empty:
            continue

        polygon = polygon.simplify(simplify_tolerance, preserve_topology=True)

        if polygon.geom_type == "MultiPolygon":
            polygons = list(polygon.geoms)
        elif polygon.geom_type == "Polygon":
            polygons = [polygon]
        else:
            continue

        for poly in polygons:
            area_sqm = poly.area
            if area_sqm < min_area_sqm:
                continue

            centroid = poly.centroid
            max_height = float(np.nanmax(ndsm)) if not np.all(np.isnan(ndsm)) else 0
            confidence = min(1.0, 0.5 + (max_height / 20.0))

            footprints.append({
                "geometry": mapping(poly),
                "area_sqm": round(area_sqm, 2),
                "confidence": round(confidence, 4),
                "method": "nDSM",
                "threshold_m": threshold_m,
                "centroid": {"x": centroid.x, "y": centroid.y},
            })

    method_info["footprints_detected"] = len(footprints)
    return footprints, method_info
