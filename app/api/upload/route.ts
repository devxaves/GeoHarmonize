/**
 * GeoSync — POST /api/upload
 * Forwards uploaded files to the geo-engine, optionally runs OCR/NER on scanned docs.
 * Stores processed document metadata in documents table.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSystemActorId } from "@/lib/actor";
import { query } from "@/lib/db/pool";

const GEO_ENGINE_URL = process.env.GEO_ENGINE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const actorId = await getSystemActorId();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sourceType = formData.get("source_type") as string | null;
    const declaredCrs = formData.get("declared_crs") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!sourceType) {
      return NextResponse.json({ error: "source_type is required." }, { status: 400 });
    }

    // Forward to geo-engine
    const geoFormData = new FormData();
    geoFormData.append("file", file);
    geoFormData.append("source_type", sourceType);
    geoFormData.append("uploaded_by", actorId || "system");
    if (declaredCrs) geoFormData.append("declared_crs", declaredCrs);

    const geoRes = await fetch(`${GEO_ENGINE_URL}/api/geo/datasets/upload`, {
      method: "POST",
      body: geoFormData,
    });

    if (!geoRes.ok) {
      const err = await geoRes.text();
      return NextResponse.json(
        { error: `Geo-engine rejected upload: ${err}` },
        { status: geoRes.status }
      );
    }

    const geoData = await geoRes.json();

    // Write audit log entry
    await query(
      `INSERT INTO gh_audit_log (actor_id, entity_type, entity_id, action, after_state)
       VALUES ($1, 'dataset', $2, 'upload', $3::jsonb)`,
      [
        actorId,
        geoData.dataset_id,
        JSON.stringify({
          filename: file.name,
          source_type: sourceType,
          feature_count: geoData.feature_count,
          crs_transformation: geoData.crs_transformation,
        }),
      ]
    );

    return NextResponse.json(geoData, { status: 200 });
  } catch (err: any) {
    console.error("Upload proxy error:", err);
    return NextResponse.json({ error: err?.message || "Upload failed." }, { status: 500 });
  }
}
