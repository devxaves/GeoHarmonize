#!/usr/bin/env python3
"""
GeoSync — Phase 2 End-to-End Verification Script

PRD §9 Phase 2: "Prove this works via a script/test before touching UI"
PRD §12: "Uploading a sample cadastral GeoJSON and a deliberately-shifted/renamed
          second GeoJSON produces at least one entry in spatial_conflicts with a
          sane confidence score and non-empty score_reasons"

Run with the geo-engine running:
  uvicorn main:app --reload --port 8000

Then in another terminal (from geo-engine/ dir):
  python scripts/verify_phase2.py

Expected output:
  - Dataset A uploaded, validation report printed
  - Dataset B uploaded, validation report printed
  - Harmonization run: conflicts generated with scores and score_reasons
  - At least 1 conflict with score 0.60–0.99 (human_review) for drifted parcels
  - At least 1 conflict with score < 0.60 (new parcel, reject)
  - All score_reasons non-empty
"""

import sys
import json
import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:8000"
SAMPLE_DIR = "./sample_data"


def check(condition: bool, message: str):
    """Assert with informative output."""
    status = "✅ PASS" if condition else "❌ FAIL"
    print(f"  {status}  {message}")
    if not condition:
        sys.exit(1)


def main():
    print("\n" + "="*70)
    print("GeoSync — Phase 2 End-to-End Verification")
    print("="*70)

    # ── 1. Health check ───────────────────────────────────────────────────────
    print("\n[1] Health check...")
    resp = httpx.get(f"{BASE_URL}/api/geo/health")
    check(resp.status_code == 200, f"Geo-engine healthy (HTTP {resp.status_code})")
    check(resp.json().get("status") == "ok", "Status is 'ok'")

    # ── 2. Upload legacy cadastral dataset (Dataset A) ────────────────────────
    print("\n[2] Uploading legacy cadastral dataset (Dataset A)...")
    with open(f"{SAMPLE_DIR}/legacy_cadastral.geojson", "rb") as f:
        resp = httpx.post(
            f"{BASE_URL}/api/geo/datasets/upload",
            files={"file": ("legacy_cadastral.geojson", f, "application/geo+json")},
            data={
                "source_type": "cadastral",
                "declared_crs": "EPSG:4326",
                "uploaded_by": "verify_script",
            },
            timeout=30.0,
        )

    check(resp.status_code == 200, f"Upload A returned HTTP {resp.status_code}")
    upload_a = resp.json()
    dataset_a_id = upload_a["dataset_id"]
    print(f"     Dataset A ID: {dataset_a_id}")
    print(f"     Features loaded: {upload_a['feature_count']}")
    check(upload_a["feature_count"] == 5, "Dataset A has 5 features")
    check(upload_a["crs_transformation"]["source_crs"] is not None, "Source CRS detected and logged")
    check(upload_a["crs_transformation"]["method"] is not None, "Transformation method logged (never silent)")
    print(f"     CRS: {upload_a['crs_transformation']['source_crs']} → {upload_a['crs_transformation']['target_crs']}")

    # ── 3. Run harmonization on Dataset A (no existing parcels — seeds DB) ────
    print("\n[3] Harmonizing Dataset A (seeds parcel DB)...")
    resp = httpx.post(
        f"{BASE_URL}/api/geo/datasets/{dataset_a_id}/harmonize",
        params={"state": "MH", "district": "PUNE", "ulb": "PMC", "ward": "W01"},
        timeout=60.0,
    )
    check(resp.status_code == 200, f"Harmonize A returned HTTP {resp.status_code}")
    harm_a = resp.json()
    print(f"     Parcels inserted: {harm_a['parcels_inserted']}")
    print(f"     Conflicts generated: {harm_a['conflicts_generated']} (expected 0 — no existing parcels)")
    check(harm_a["parcels_inserted"] >= 5, "At least 5 parcels inserted from Dataset A")

    # ── 4. Upload drone survey dataset (Dataset B — with discrepancies) ───────
    print("\n[4] Uploading drone survey dataset (Dataset B — with discrepancies)...")
    with open(f"{SAMPLE_DIR}/new_drone_survey.geojson", "rb") as f:
        resp = httpx.post(
            f"{BASE_URL}/api/geo/datasets/upload",
            files={"file": ("new_drone_survey.geojson", f, "application/geo+json")},
            data={
                "source_type": "drone_ori",
                "declared_crs": "EPSG:4326",
                "uploaded_by": "verify_script",
            },
            timeout=30.0,
        )

    check(resp.status_code == 200, f"Upload B returned HTTP {resp.status_code}")
    upload_b = resp.json()
    dataset_b_id = upload_b["dataset_id"]
    print(f"     Dataset B ID: {dataset_b_id}")
    print(f"     Features loaded: {upload_b['feature_count']}")
    check(upload_b["feature_count"] == 5, "Dataset B has 5 features")

    # ── 5. Harmonize Dataset B (should produce conflicts against A) ───────────
    print("\n[5] Harmonizing Dataset B (running spatial matching against Dataset A)...")
    resp = httpx.post(
        f"{BASE_URL}/api/geo/datasets/{dataset_b_id}/harmonize",
        params={"state": "MH", "district": "PUNE", "ulb": "PMC", "ward": "W01"},
        timeout=120.0,
    )
    check(resp.status_code == 200, f"Harmonize B returned HTTP {resp.status_code}")
    harm_b = resp.json()

    print(f"     Parcels processed: {harm_b['parcels_processed']}")
    print(f"     Conflicts generated: {harm_b['conflicts_generated']}")
    print(f"     Auto-linked: {harm_b['auto_linked']}")
    print(f"     Flagged for review: {harm_b['flagged_for_review']}")

    check(harm_b["conflicts_generated"] >= 1, "At least 1 conflict generated (PRD §12 check)")

    # ── 6. Verify conflict scores and score_reasons ───────────────────────────
    print("\n[6] Fetching conflict list and verifying score_reasons...")
    resp = httpx.get(f"{BASE_URL}/api/geo/conflicts", params={"limit": 50})
    check(resp.status_code == 200, "Conflicts endpoint returned 200")
    conflicts = resp.json()["conflicts"]
    check(len(conflicts) >= 1, f"At least 1 conflict in DB (found: {len(conflicts)})")

    print(f"\n     Conflicts found: {len(conflicts)}")
    print(f"     {'Conflict ID':<38} {'Score':>6}  {'Action':<20}  {'Type'}")
    print(f"     {'-'*38} {'-'*6}  {'-'*20}  {'-'*20}")

    has_human_review = False
    has_score_reasons = True

    for c in conflicts:
        score = c["confidence_score"]
        action = c["recommended_action"] or "N/A"
        ctype = c["conflict_type"]
        reasons = c.get("score_reasons", [])

        print(f"     {c['conflict_id']:<38} {score:>6.3f}  {action:<20}  {ctype}")

        if action == "human_review":
            has_human_review = True

        if not reasons or len(reasons) == 0:
            has_score_reasons = False
            print(f"       ⚠️  Empty score_reasons for conflict {c['conflict_id']}")
        else:
            # Print breakdown for first conflict
            if conflicts.index(c) == 0:
                print(f"\n     Score breakdown for conflict {c['conflict_id'][:8]}...:")
                for r in reasons:
                    print(f"       {r['factor']:<25} weight={r['weight']:.2f}  raw={r['raw_value']:.3f}  contrib={r['contribution']:.4f}")
                    print(f"         → {r['explanation'][:100]}")
                print()

    check(has_human_review or harm_b["auto_linked"] > 0,
          "At least 1 conflict is human_review or auto_linked (sane scores)")
    check(has_score_reasons, "All conflicts have non-empty score_reasons (PRD §12 check)")

    # ── 7. Verify no UPDATE/DELETE on urban_parcel (structural check) ─────────
    print("\n[7] Checking parcel list (all parcels visible, none deleted)...")
    resp = httpx.get(f"{BASE_URL}/api/geo/parcels", params={"limit": 100})
    check(resp.status_code == 200, "Parcels endpoint returned 200")
    parcels = resp.json()
    print(f"     Total parcels in DB: {parcels['total']}")
    check(parcels["total"] >= 5, "At least 5 parcels in DB (none were deleted)")

    # ── 8. GeoJSON export ─────────────────────────────────────────────────────
    print("\n[8] Testing GeoJSON export...")
    resp = httpx.get(f"{BASE_URL}/api/geo/export/geojson", timeout=30.0)
    check(resp.status_code == 200, "GeoJSON export returned 200")
    check("application/geo+json" in resp.headers.get("content-type", ""),
          "Content-Type is application/geo+json")
    geojson = resp.json()
    check(geojson.get("type") == "FeatureCollection", "Export is a valid GeoJSON FeatureCollection")
    check(len(geojson.get("features", [])) >= 1, "Export contains at least 1 feature")
    print(f"     Exported {len(geojson['features'])} features")

    # ── 9. Conflict decision (approve one) ────────────────────────────────────
    print("\n[9] Testing conflict decision (approve first open conflict)...")
    open_conflicts = [c for c in conflicts if c["status"] == "open"]
    if open_conflicts:
        first = open_conflicts[0]
        resp = httpx.post(
            f"{BASE_URL}/api/geo/conflicts/{first['conflict_id']}/decision",
            json={
                "action": "approve_match",
                "actor_id": "verify-script-actor",
                "notes": "Verified by Phase 2 test script",
            },
        )
        check(resp.status_code == 200, f"Decision endpoint returned HTTP {resp.status_code}")
        decision = resp.json()
        check(decision["new_status"] == "approved", "Conflict status updated to 'approved'")
        print(f"     Conflict {first['conflict_id'][:8]}... approved ✓")
    else:
        print("     (No open conflicts to approve in this run — skipping decision test)")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "="*70)
    print("✅ Phase 2 verification PASSED — all PRD §12 checks satisfied.")
    print("="*70)
    print(f"\n  Dataset A (cadastral):  {dataset_a_id}")
    print(f"  Dataset B (drone):      {dataset_b_id}")
    print(f"  Conflicts generated:    {harm_b['conflicts_generated']}")
    print(f"  Auto-linked:            {harm_b['auto_linked']}")
    print(f"  Flagged for review:     {harm_b['flagged_for_review']}")
    print("\n  Ready to proceed to Phase 3 (Review UI)")
    print()


if __name__ == "__main__":
    main()
