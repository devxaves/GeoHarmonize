/**
 * GeoSync — Audit Actor
 * GeoSync runs without sign-in, so audit entries are attributed to the
 * system's configured admin/reviewer account in gh_users.
 */

import { query } from "./db/pool";

let cachedActorId: string | null | undefined;

export async function getSystemActorId(): Promise<string | null> {
  if (cachedActorId !== undefined) return cachedActorId;

  const { rows } = await query<{ id: string }>(
    `SELECT id FROM gh_users
     WHERE role IN ('admin', 'reviewer')
     ORDER BY (role = 'admin') DESC, created_at ASC
     LIMIT 1`
  );
  // Only cache a hit, so a user seeded later is picked up without a restart
  if (rows.length > 0) cachedActorId = rows[0].id;
  return rows[0]?.id ?? null;
}
