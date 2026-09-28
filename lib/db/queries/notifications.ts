/**
 * BhoomiSetu — Notifications Query Module (Raw SQL)
 * Statutory notification tracking (Section 11 / Section 19).
 */

import { query } from '../pool';

// ============================================================
// Types
// ============================================================
export interface Notification {
  id: string;
  project_id: string;
  section: 'section_11' | 'section_19';
  notified_on: string;
  deadline_on: string;
  document_id: string | null;
  created_at: string;
}

export interface DeadlineStatus extends Notification {
  project_name: string;
  project_district: string;
  days_elapsed: number;
  days_total: number;
  pct_elapsed: number;
  urgency: 'green' | 'amber' | 'red' | 'lapsed';
}

// ============================================================
// Queries
// ============================================================

/** Create a new statutory notification */
export async function createNotification(input: {
  project_id: string;
  section: 'section_11' | 'section_19';
  notified_on: string; // ISO date string
  document_id?: string;
}): Promise<Notification> {
  // Deadline is notified_on + 12 months per RFCTLARR Act
  const { rows } = await query<Notification>(
    `INSERT INTO notifications (project_id, section, notified_on, deadline_on, document_id)
     VALUES ($1, $2, $3::date, ($3::date + INTERVAL '12 months')::date, $4)
     RETURNING *`,
    [
      input.project_id,
      input.section,
      input.notified_on,
      input.document_id || null,
    ]
  );
  return rows[0];
}

/** Get notifications for a project */
export async function getNotificationsByProject(projectId: string): Promise<Notification[]> {
  const { rows } = await query<Notification>(
    'SELECT * FROM notifications WHERE project_id = $1 ORDER BY notified_on',
    [projectId]
  );
  return rows;
}

/**
 * Get all upcoming/active deadlines with urgency status.
 * Used by the statutory deadline scanner (Phase 4 cron) and dashboard.
 */
export async function getUpcomingDeadlines(): Promise<DeadlineStatus[]> {
  const { rows } = await query<DeadlineStatus>(
    `SELECT
       n.*,
       p.name as project_name,
       p.district as project_district,
       GREATEST(0, CURRENT_DATE - n.notified_on) as days_elapsed,
       GREATEST(1, n.deadline_on - n.notified_on) as days_total,
       ROUND(
         GREATEST(0, CURRENT_DATE - n.notified_on)::numeric /
         GREATEST(1, n.deadline_on - n.notified_on)::numeric * 100, 1
       ) as pct_elapsed,
       CASE
         WHEN CURRENT_DATE > n.deadline_on THEN 'lapsed'
         WHEN GREATEST(0, CURRENT_DATE - n.notified_on)::numeric /
              GREATEST(1, n.deadline_on - n.notified_on)::numeric > 0.90 THEN 'red'
         WHEN GREATEST(0, CURRENT_DATE - n.notified_on)::numeric /
              GREATEST(1, n.deadline_on - n.notified_on)::numeric > 0.60 THEN 'amber'
         ELSE 'green'
       END as urgency
     FROM notifications n
     JOIN projects p ON p.id = n.project_id
     WHERE p.current_stage NOT IN ('closed')
     ORDER BY n.deadline_on ASC`
  );
  return rows;
}
