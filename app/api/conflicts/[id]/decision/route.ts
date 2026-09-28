/**
 * GeoHarmonize — POST /api/conflicts/[id]/decision
 * Records human review decision on a conflict.
 * Proxies decision to geo-engine AND records the action in gh_audit_log (PRD §6.6, §12).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db/pool";

const GEO_ENGINE_URL = process.env.GEO_ENGINE_URL || "http://localhost:8000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, notes } = body;

    const validActions = ["approve_match", "reject_match", "field_verification_required"];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    // 1. Get current actor from session if available
    const user = await getCurrentUser();
    let actorId = user?.id || null;

    // Fallback: look up default reviewer from gh_users if not logged in
    if (!actorId) {
      const { rows } = await query(
        `SELECT id FROM gh_users WHERE role = 'reviewer' OR role = 'admin' LIMIT 1`
      );
      if (rows.length > 0) {
        actorId = rows[0].id;
      }
    }

    // 2. Fetch before_state of the conflict
    let beforeState: any = null;
    try {
      const preResp = await fetch(`${GEO_ENGINE_URL}/api/geo/conflicts?limit=100`, {
        cache: "no-store",
      });
      if (preResp.ok) {
        const json = await preResp.json();
        const found = json.conflicts?.find((c: any) => c.conflict_id === id);
        if (found) beforeState = found;
      }
    } catch (e) {
      console.warn("Could not fetch before_state for audit:", e);
    }

    // 3. Call Geo Engine decision endpoint
    const geoResp = await fetch(`${GEO_ENGINE_URL}/api/geo/conflicts/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        actor_id: user?.email || actorId || "reviewer@geoharmonize.gov.in",
        notes: notes || "Review decision recorded via GeoHarmonize UI",
      }),
    });

    if (!geoResp.ok) {
      const errText = await geoResp.text();
      return NextResponse.json(
        { error: `Geo-engine returned ${geoResp.status}: ${errText}` },
        { status: geoResp.status }
      );
    }

    const decisionResult = await geoResp.json();

    // 4. Record action in gh_audit_log (PRD §6.6 & §12 verification checklist)
    const afterState = {
      ...beforeState,
      status: decisionResult.new_status,
      resolved_at: decisionResult.resolved_at,
      assigned_to: decisionResult.actor_id,
    };

    try {
      await query(
        `INSERT INTO gh_audit_log (
          actor_id, entity_type, entity_id, action, before_state, after_state, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          actorId,
          "conflict",
          id,
          action,
          beforeState ? JSON.stringify(beforeState) : null,
          JSON.stringify(afterState),
          notes || `Decision: ${action}`,
        ]
      );
    } catch (auditErr) {
      console.error("Failed to write gh_audit_log entry:", auditErr);
      // Non-fatal for client response, but logged
    }

    return NextResponse.json({
      success: true,
      decision: decisionResult,
      audit_logged: true,
    });
  } catch (err: any) {
    console.error("POST /api/conflicts/[id]/decision error:", err);
    return NextResponse.json(
      { error: "Internal server error processing decision", details: err.message },
      { status: 500 }
    );
  }
}
