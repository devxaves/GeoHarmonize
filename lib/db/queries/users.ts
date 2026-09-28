/**
 * BhoomiSetu — Users Query Module (Raw SQL)
 * DB-based user management (no external auth provider)
 */

import { query } from '../pool';

// ============================================================
// Types
// ============================================================
export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  role: 'admin' | 'reviewer' | 'viewer';
  name: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Queries
// ============================================================

/** Get user by internal ID */
export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await query<User>(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/** Get user by email */
export async function getUserByEmail(email: string): Promise<User | null> {
  const { rows } = await query<User>(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return rows[0] || null;
}

/** Update user role (admin action) */
export async function updateUserRole(
  userId: string,
  role: User['role'],
): Promise<User> {
  const { rows } = await query<User>(
    `UPDATE users SET role = $1, updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [role, userId]
  );
  if (rows.length === 0) {
    throw new Error(`User not found: ${userId}`);
  }
  return rows[0];
}

/** List all users (admin view) */
export async function listUsers(): Promise<User[]> {
  const { rows } = await query<User>(
    'SELECT id, email, role, name, created_at, updated_at FROM users ORDER BY created_at DESC'
  );
  return rows;
}
