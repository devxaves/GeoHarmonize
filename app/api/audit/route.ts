/**
 * GeoHarmonize — GET/POST /api/audit
 * Audit log — filterable by entity_type, entity_id, actor, action, date range.
 * Every human review action in the system is logged here (PRD §4.1).
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const entityType = searchParams.get("entity_type");
    const entityId = searchParams.get("entity_id");
    const actorId = searchParams.get("actor_id");
    const action = searchParams.get("action");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 500);
    const offset = parseInt(searchParams.get("offset") || "0");

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let i = 1;

    if (entityType) { conditions.push(`a.entity_type = $${i++}`); params.push(entityType); }
    if (entityId) { conditions.push(`a.entity_id = $${i++}`); params.push(entityId); }
    if (actorId) { conditions.push(`a.actor_id::text = $${i++}`); params.push(actorId); }
    if (action) { conditions.push(`a.action = $${i++}`); params.push(action); }
    if (from) { conditions.push(`a.created_at >= $${i++}`); params.push(from); }
    if (to) { conditions.push(`a.created_at <= $${i++}`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*) FROM gh_audit_log a ${where}`, params
    );
    const total = parseInt(countRes.rows[0].count);

    const pageParams = [...params, limit, offset];
    const { rows } = await query(
      `SELECT a.id, a.actor_id, u.email as actor_email, u.name as actor_name,
              a.entity_type, a.entity_id, a.action,
              a.before_state, a.after_state, a.notes, a.created_at
       FROM gh_audit_log a
       LEFT JOIN gh_users u ON u.id = a.actor_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      pageParams
    );

    return NextResponse.json({ total, limit, offset, entries: rows });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    console.error("Audit log error:", err);
    return NextResponse.json({ error: "Failed to fetch audit log." }, { status: 500 });
  }
}

/**
 * POST /api/audit — write an audit log entry
 * Called internally when a conflict decision is made.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { entity_type, entity_id, action, before_state, after_state, notes } = body;

    if (!entity_type || !entity_id || !action) {
      return NextResponse.json(
        { error: "entity_type, entity_id, and action are required." },
        { status: 400 }
      );
    }

    const { rows } = await query<{ id: string }>(
      `INSERT INTO gh_audit_log (actor_id, entity_type, entity_id, action, before_state, after_state, notes)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       RETURNING id`,
      [
        user.id,
        entity_type,
        entity_id,
        action,
        before_state ? JSON.stringify(before_state) : null,
        after_state ? JSON.stringify(after_state) : null,
        notes || null,
      ]
    );

    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    console.error("Audit write error:", err);
    return NextResponse.json({ error: "Failed to write audit log." }, { status: 500 });
  }
}
