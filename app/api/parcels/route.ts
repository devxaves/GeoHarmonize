/**
 * GeoSync — GET /api/parcels, POST /api/parcels
 * GET proxies parcel list queries to geo-engine.
 * POST submits an officer-demarcated boundary to geo-engine (matched + scored
 * like any other dataset) and records the action in gh_audit_log.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSystemActorId } from "@/lib/actor";
import { query } from "@/lib/db/pool";

const GEO_ENGINE_URL = process.env.GEO_ENGINE_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = new URL(`${GEO_ENGINE_URL}/api/geo/parcels`);
    searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    const resp = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { error: `Geo-engine returned ${resp.status}: ${errText}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("GET /api/parcels proxy error:", err);
    return NextResponse.json(
      { error: "Failed to connect to geo-engine service", details: err.message },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.geometry?.type !== "Polygon") {
      return NextResponse.json({ error: "Draw the parcel boundary on the map first." }, { status: 400 });
    }

    const resp = await fetch(`${GEO_ENGINE_URL}/api/geo/parcels/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const detail = typeof data?.detail === "string" ? data.detail : `Geo-engine returned ${resp.status}`;
      return NextResponse.json({ error: detail }, { status: resp.status });
    }

    // A dry run only previews matches — nothing was written, so nothing to audit
    if (!data.dry_run) {
      try {
        const actorId = await getSystemActorId();
        await query(
          `INSERT INTO gh_audit_log (
            actor_id, entity_type, entity_id, action, before_state, after_state, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            actorId,
            "parcel",
            data.parcel_uid,
            "manual_demarcation",
            null,
            JSON.stringify({
              parcel_uid: data.parcel_uid,
              dataset_id: data.dataset_id,
              survey_basis: body.survey_basis,
              survey_number: body.survey_number ?? null,
              owner_name: body.owner_name ?? null,
              geometry: data.geometry,
              geometry_area_sqm: data.geometry_area_sqm,
              validation_status: data.validation_status,
              conflicts: (data.matches ?? []).map((m: any) => m.conflict_id),
            }),
            body.notes || `Boundary demarcated by ${body.surveyed_by || "officer"}`,
          ]
        );
        data.audit_logged = true;
      } catch (auditErr) {
        console.error("Failed to write gh_audit_log entry:", auditErr);
        data.audit_logged = false;
      }
    }

    return NextResponse.json(data, { status: data.dry_run ? 200 : 201 });
  } catch (err: any) {
    console.error("POST /api/parcels proxy error:", err);
    return NextResponse.json(
      { error: "Failed to connect to geo-engine service", details: err.message },
      { status: 503 }
    );
  }
}
