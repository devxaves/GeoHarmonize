/**
 * GeoSync — POST /api/demo/seed
 * One-click demo seed route:
 * 1. Uploads legacy cadastral sample
 * 2. Runs harmonization (seeds baseline parcels)
 * 3. Uploads drone survey sample with realistic discrepancies
 * 4. Runs harmonization (generates conflicts with 5-factor scoring)
 * 5. Returns dataset IDs and conflict stats for instant UI demo
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GEO_ENGINE_URL = process.env.GEO_ENGINE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const sampleDir = path.join(process.cwd(), "geo-engine", "sample_data");
    const legacyPath = path.join(sampleDir, "legacy_cadastral.geojson");
    const dronePath = path.join(sampleDir, "new_drone_survey.geojson");

    if (!fs.existsSync(legacyPath) || !fs.existsSync(dronePath)) {
      return NextResponse.json(
        { error: "Sample data files not found in geo-engine/sample_data/" },
        { status: 404 }
      );
    }

    // 1. Upload Legacy Cadastral
    const legacyBlob = new Blob([fs.readFileSync(legacyPath)], { type: "application/geo+json" });
    const formA = new FormData();
    formA.append("file", legacyBlob, "legacy_cadastral.geojson");
    formA.append("source_type", "cadastral");
    formA.append("declared_crs", "EPSG:4326");
    formA.append("uploaded_by", "demo_operator");

    const upResA = await fetch(`${GEO_ENGINE_URL}/api/geo/datasets/upload`, {
      method: "POST",
      body: formA,
    });
    if (!upResA.ok) throw new Error(`Upload A failed: ${await upResA.text()}`);
    const dataA = await upResA.json();

    // 2. Harmonize Legacy Cadastral (seeds DB)
    const harmResA = await fetch(
      `${GEO_ENGINE_URL}/api/geo/datasets/${dataA.dataset_id}/harmonize?state=MH&district=PUNE&ulb=PMC&ward=W01`,
      { method: "POST" }
    );
    if (!harmResA.ok) throw new Error(`Harmonize A failed: ${await harmResA.text()}`);
    const harmDataA = await harmResA.json();

    // 3. Upload Drone Survey
    const droneBlob = new Blob([fs.readFileSync(dronePath)], { type: "application/geo+json" });
    const formB = new FormData();
    formB.append("file", droneBlob, "new_drone_survey.geojson");
    formB.append("source_type", "drone_ori");
    formB.append("declared_crs", "EPSG:4326");
    formB.append("uploaded_by", "demo_operator");

    const upResB = await fetch(`${GEO_ENGINE_URL}/api/geo/datasets/upload`, {
      method: "POST",
      body: formB,
    });
    if (!upResB.ok) throw new Error(`Upload B failed: ${await upResB.text()}`);
    const dataB = await upResB.json();

    // 4. Harmonize Drone Survey (matches against baseline)
    const harmResB = await fetch(
      `${GEO_ENGINE_URL}/api/geo/datasets/${dataB.dataset_id}/harmonize?state=MH&district=PUNE&ulb=PMC&ward=W01`,
      { method: "POST" }
    );
    if (!harmResB.ok) throw new Error(`Harmonize B failed: ${await harmResB.text()}`);
    const harmDataB = await harmResB.json();

    return NextResponse.json({
      success: true,
      message: "Demo datasets ingested and harmonized successfully",
      dataset_a: {
        id: dataA.dataset_id,
        features: dataA.feature_count,
        parcels_inserted: harmDataA.parcels_inserted,
        crs: dataA.crs_transformation,
      },
      dataset_b: {
        id: dataB.dataset_id,
        features: dataB.feature_count,
        conflicts_generated: harmDataB.conflicts_generated,
        auto_linked: harmDataB.auto_linked,
        flagged_for_review: harmDataB.flagged_for_review,
      },
    });
  } catch (err: any) {
    console.error("POST /api/demo/seed error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
