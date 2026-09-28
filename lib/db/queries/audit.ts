/**
 * BhoomiSetu — Audit Log Query Module (Raw SQL)
 * Immutable audit trail for all entity changes.
 */

import { query } from '../pool';

// ============================================================
// Types
// ============================================================
export interface AuditEntry {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before_state: object | null;
  after_state: object | null;
  created_at: string;
}

// ============================================================
// Queries
// ============================================================

/** Log an audit entry */
export async function logAuditEntry(input: {
  actor_id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before_state?: object;
  after_state?: object;
}): Promise<AuditEntry> {
  const { rows } = await query<AuditEntry>(
    `INSERT INTO audit_log (actor_id, entity_type, entity_id, action, before_state, after_state)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.actor_id || null,
      input.entity_type,
      input.entity_id,
      input.action,
      input.before_state ? JSON.stringify(input.before_state) : null,
      input.after_state ? JSON.stringify(input.after_state) : null,
    ]
  );
  return rows[0];
}

/** Get audit trail for an entity */
export async function getAuditTrail(
  entityType: string,
  entityId: string
): Promise<AuditEntry[]> {
  const { rows } = await query<AuditEntry>(
    `SELECT * FROM audit_log
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC`,
    [entityType, entityId]
  );
  return rows;
}

/** Get recent audit entries (for dashboard activity feed) */
export async function getRecentAuditEntries(limit: number = 20): Promise<AuditEntry[]> {
  const { rows } = await query<AuditEntry>(
    `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}
