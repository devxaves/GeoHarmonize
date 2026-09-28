"""
GeoHarmonize — Confidence Scoring Engine
Implements EXACTLY the formula from PRD §5. Do not change weights.

score = (
    0.35 * geometry_overlap_score      # IoU between candidate geometries
  + 0.20 * attribute_similarity_score  # RapidFuzz on names/IDs
  + 0.15 * identifier_match_score      # survey number / property ID exact or fuzzy
  + 0.15 * source_reliability_score    # static weight per source_type
  + 0.15 * temporal_recency_score      # newer data scores higher
)

Thresholds (PRD §5):
  score >= 0.90  → validation_status = 'auto_linked'
  0.60 <= score < 0.90  → recommended_action = 'human_review'
  score < 0.60  → unresolved / new feature

Every score is returned with a score_reasons list:
  [{factor, weight, raw_value, contribution, explanation}]
These are stored in spatial_conflicts.score_reasons and rendered in the UI.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone

from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from rapidfuzz import fuzz
from config import settings


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class ParcelCandidate:
    """Minimal parcel attributes needed for scoring."""
    parcel_uid: str
    geometry: dict               # GeoJSON Polygon dict
    survey_number: Optional[str]
    plot_number: Optional[str]
    property_id: Optional[str]
    owner_name: Optional[str]
    owner_name_normalized: Optional[str]
    source_type: str             # e.g. 'cadastral', 'drone_ori', 'revenue'
    recorded_area_sqm: Optional[float]
    created_at: datetime


@dataclass
class ScoreReason:
    factor: str
    weight: float
    raw_value: float             # the 0–1 sub-score before weighting
    contribution: float          # weight * raw_value
    explanation: str

    def to_dict(self) -> dict:
        return {
            "factor": self.factor,
            "weight": self.weight,
            "raw_value": round(self.raw_value, 4),
            "contribution": round(self.contribution, 4),
            "explanation": self.explanation,
        }


@dataclass
class ScoringResult:
    score: float
    score_reasons: list[ScoreReason]
    recommended_action: str     # 'auto_merge' | 'human_review' | 'reject'
    conflict_type: str
    geometry_diff: Optional[dict]  # GeoJSON of the difference polygon
    difference_value: Optional[float]

    def to_dict(self) -> dict:
        return {
            "score": round(self.score, 4),
            "score_reasons": [r.to_dict() for r in self.score_reasons],
            "recommended_action": self.recommended_action,
            "conflict_type": self.conflict_type,
            "geometry_diff": self.geometry_diff,
            "difference_value": self.difference_value,
        }


# ── Geometry helpers ──────────────────────────────────────────────────────────

def compute_iou(geom_a: dict, geom_b: dict) -> tuple[float, Optional[dict]]:
    """
    Compute Intersection-over-Union (IoU) between two GeoJSON polygons.
    Returns (iou_score, difference_geojson).
    difference_geojson is the symmetric difference polygon (for map display).
    """
    try:
        sha = shape(geom_a)
        shb = shape(geom_b)

        if not sha.is_valid:
            sha = sha.buffer(0)
        if not shb.is_valid:
            shb = shb.buffer(0)

        intersection = sha.intersection(shb)
        union = sha.union(shb)

        if union.is_empty or union.area == 0:
            return 0.0, None

        iou = intersection.area / union.area

        # Symmetric difference for display
        sym_diff = sha.symmetric_difference(shb)
        diff_geojson = mapping(sym_diff) if not sym_diff.is_empty else None

        return float(iou), diff_geojson
    except Exception:
        return 0.0, None


def compute_area_diff_sqm(geom_a: dict, geom_b: dict) -> float:
    """Area difference in square metres (approx, geographic degrees → sqm using centroid lat)."""
    import math
    try:
        sha = shape(geom_a)
        shb = shape(geom_b)
        # Rough: 1 degree ≈ 111320m at equator; adjust by cos(lat)
        centroid_lat = sha.centroid.y
        deg_to_m = 111320.0 * math.cos(math.radians(centroid_lat))
        area_a = sha.area * deg_to_m ** 2
        area_b = shb.area * deg_to_m ** 2
        return abs(area_a - area_b)
    except Exception:
        return 0.0


# ── Attribute normalization ───────────────────────────────────────────────────

def normalize_name(name: Optional[str]) -> str:
    """
    Normalize owner names for fuzzy comparison:
    lowercase, strip punctuation, collapse whitespace.
    Does NOT do transliteration (that would require a separate library).
    """
    if not name:
        return ""
    import re
    name = name.lower()
    name = re.sub(r"[^\w\s]", " ", name)   # strip punctuation
    name = re.sub(r"\s+", " ", name).strip()
    return name


def normalize_survey_number(sn: Optional[str]) -> str:
    """Strip spaces, dashes, slashes; lowercase."""
    if not sn:
        return ""
    import re
    return re.sub(r"[\s\-\/]", "", sn).lower()


# ── Sub-scorers ───────────────────────────────────────────────────────────────

def score_geometry_overlap(parcel_a: ParcelCandidate, parcel_b: ParcelCandidate) -> tuple[float, Optional[dict], Optional[float]]:
    """Returns (iou_score, diff_geojson, area_diff_sqm)."""
    iou, diff = compute_iou(parcel_a.geometry, parcel_b.geometry)
    area_diff = compute_area_diff_sqm(parcel_a.geometry, parcel_b.geometry)
    return iou, diff, area_diff


def score_attribute_similarity(parcel_a: ParcelCandidate, parcel_b: ParcelCandidate) -> float:
    """
    RapidFuzz token_sort_ratio on normalized owner names.
    Returns 0–1.
    """
    name_a = parcel_a.owner_name_normalized or normalize_name(parcel_a.owner_name)
    name_b = parcel_b.owner_name_normalized or normalize_name(parcel_b.owner_name)

    if not name_a or not name_b:
        return 0.5  # neutral when one side has no owner data

    ratio = fuzz.token_sort_ratio(name_a, name_b) / 100.0
    return float(ratio)


def score_identifier_match(parcel_a: ParcelCandidate, parcel_b: ParcelCandidate) -> float:
    """
    Survey number / plot number / property ID matching.
    Exact match → 1.0, fuzzy ≥80% → 0.8, partial → 0.4, no data → 0.5
    """
    sn_a = normalize_survey_number(parcel_a.survey_number)
    sn_b = normalize_survey_number(parcel_b.survey_number)

    if sn_a and sn_b:
        if sn_a == sn_b:
            return 1.0
        ratio = fuzz.ratio(sn_a, sn_b) / 100.0
        if ratio >= 0.80:
            return 0.8
        if ratio >= 0.60:
            return 0.4
        return 0.1

    # Fall back to property ID or plot number
    pid_a = normalize_survey_number(parcel_a.property_id or parcel_a.plot_number)
    pid_b = normalize_survey_number(parcel_b.property_id or parcel_b.plot_number)

    if pid_a and pid_b:
        if pid_a == pid_b:
            return 1.0
        return fuzz.ratio(pid_a, pid_b) / 100.0

    return 0.5  # neutral when no identifiers available


def score_source_reliability(parcel_a: ParcelCandidate, parcel_b: ParcelCandidate) -> float:
    """
    Average of source reliability for the two parcels.
    Static weights from settings (config.py), per PRD §5.
    """
    rel_a = settings.source_reliability(parcel_a.source_type)
    rel_b = settings.source_reliability(parcel_b.source_type)
    return (rel_a + rel_b) / 2.0


def score_temporal_recency(parcel_a: ParcelCandidate, parcel_b: ParcelCandidate) -> float:
    """
    Newer data → higher score.
    Uses the newer of the two parcels' created_at timestamps.
    Reference point: 5 years old = 0.0, 0 days old = 1.0. Linear decay.
    """
    MAX_AGE_DAYS = 365 * 5  # 5 years → score 0.0
    now = datetime.now(timezone.utc)

    def age_score(dt: datetime) -> float:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        age_days = (now - dt).days
        return max(0.0, 1.0 - (age_days / MAX_AGE_DAYS))

    # Score based on the newer dataset (the one being harmonized)
    newer_score = max(age_score(parcel_a.created_at), age_score(parcel_b.created_at))
    return newer_score


# ── Main scoring function ─────────────────────────────────────────────────────

def score_candidate_pair(
    parcel_a: ParcelCandidate,
    parcel_b: ParcelCandidate,
) -> ScoringResult:
    """
    Score a candidate pair using the PRD §5 formula exactly.
    Returns a ScoringResult with full score_reasons for UI rendering.
    """

    # ── 1. Geometry overlap (IoU) ─────────────────────────────────────────────
    geo_score, diff_geojson, area_diff = score_geometry_overlap(parcel_a, parcel_b)
    geo_contribution = 0.35 * geo_score

    # ── 2. Attribute similarity (RapidFuzz) ───────────────────────────────────
    attr_score = score_attribute_similarity(parcel_a, parcel_b)
    attr_contribution = 0.20 * attr_score

    # ── 3. Identifier match (survey / property ID) ────────────────────────────
    id_score = score_identifier_match(parcel_a, parcel_b)
    id_contribution = 0.15 * id_score

    # ── 4. Source reliability (static weight per source_type) ─────────────────
    rel_score = score_source_reliability(parcel_a, parcel_b)
    rel_contribution = 0.15 * rel_score

    # ── 5. Temporal recency ───────────────────────────────────────────────────
    rec_score = score_temporal_recency(parcel_a, parcel_b)
    rec_contribution = 0.15 * rec_score

    # ── Total score ───────────────────────────────────────────────────────────
    total = geo_contribution + attr_contribution + id_contribution + rel_contribution + rec_contribution

    # ── Score reasons (for UI breakdown + audit) ──────────────────────────────
    reasons = [
        ScoreReason(
            factor="geometry_overlap",
            weight=0.35,
            raw_value=geo_score,
            contribution=geo_contribution,
            explanation=f"IoU (Intersection-over-Union) between the two parcel geometries is {geo_score:.1%}. "
                        f"{'Good spatial overlap.' if geo_score >= 0.7 else 'Low spatial overlap — boundary drift likely.' if geo_score >= 0.3 else 'Minimal overlap — may be completely different parcels.'}",
        ),
        ScoreReason(
            factor="attribute_similarity",
            weight=0.20,
            raw_value=attr_score,
            contribution=attr_contribution,
            explanation=f"Owner name fuzzy match (RapidFuzz token_sort_ratio): {attr_score:.1%}. "
                        f"Comparing '{parcel_a.owner_name or 'N/A'}' vs '{parcel_b.owner_name or 'N/A'}'.",
        ),
        ScoreReason(
            factor="identifier_match",
            weight=0.15,
            raw_value=id_score,
            contribution=id_contribution,
            explanation=f"Survey number / property ID match: {id_score:.1%}. "
                        f"Comparing survey '{parcel_a.survey_number or 'N/A'}' vs '{parcel_b.survey_number or 'N/A'}'.",
        ),
        ScoreReason(
            factor="source_reliability",
            weight=0.15,
            raw_value=rel_score,
            contribution=rel_contribution,
            explanation=f"Average source reliability: {rel_score:.1%}. "
                        f"Source A ({parcel_a.source_type}): {settings.source_reliability(parcel_a.source_type):.0%}, "
                        f"Source B ({parcel_b.source_type}): {settings.source_reliability(parcel_b.source_type):.0%}.",
        ),
        ScoreReason(
            factor="temporal_recency",
            weight=0.15,
            raw_value=rec_score,
            contribution=rec_contribution,
            explanation=f"Data recency score: {rec_score:.1%}. "
                        f"Newer datasets score higher (5-year linear decay). "
                        f"Most recent: {max(parcel_a.created_at, parcel_b.created_at).strftime('%Y-%m-%d')}.",
        ),
    ]

    # ── Classify conflict type ────────────────────────────────────────────────
    if geo_score < 0.1:
        conflict_type = "overlap" if geo_score > 0 else "boundary_mismatch"
    elif geo_score < 0.6:
        conflict_type = "boundary_mismatch"
    elif attr_score < 0.5:
        conflict_type = "attribute_mismatch"
    elif id_score < 0.4:
        conflict_type = "attribute_mismatch"
    else:
        conflict_type = "boundary_mismatch"  # minor drift

    # ── Recommend action per PRD §5 thresholds ───────────────────────────────
    if total >= settings.auto_link_threshold:
        recommended_action = "auto_merge"
    elif total >= settings.human_review_threshold:
        recommended_action = "human_review"
    else:
        recommended_action = "reject"

    return ScoringResult(
        score=total,
        score_reasons=reasons,
        recommended_action=recommended_action,
        conflict_type=conflict_type,
        geometry_diff=diff_geojson,
        difference_value=area_diff,
    )
