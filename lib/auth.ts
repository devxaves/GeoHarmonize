/**
 * GeoHarmonize — DB-based Auth Utility
 * Session management via httpOnly cookies, password hashing with bcryptjs
 * Roles: admin | reviewer | viewer  (per PRD §4.1)
 */

import bcrypt from "bcryptjs";
import { query } from "./db/pool";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_COOKIE_NAME = "geoharmonize_session";

export type UserRole = "admin" | "reviewer" | "viewer";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
}

// ── Password Hashing ────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Session Management ──────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await query(
    `INSERT INTO gh_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt.toISOString()]
  );

  return token;
}

export async function getSessionUser(token: string): Promise<AuthUser | null> {
  const { rows } = await query<{ id: string; email: string; role: string; name: string | null }>(
    `SELECT u.id, u.email, u.role, u.name
     FROM gh_sessions s
     JOIN gh_users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    name: row.name,
  };
}

export async function deleteSession(token: string): Promise<void> {
  await query(`DELETE FROM gh_sessions WHERE token = $1`, [token]);
}

// ── Get Current User from Request ───────────────────────────────────────────

export async function getCurrentUser(req?: NextRequest): Promise<AuthUser | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  }

  if (!token) return null;
  return getSessionUser(token);
}

// ── Require Auth (throws if not logged in) ──────────────────────────────────

export async function requireAuth(req?: NextRequest): Promise<AuthUser> {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireAdmin(req?: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function requireReviewer(req?: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (user.role !== "admin" && user.role !== "reviewer") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

// ── Cookie Helpers ──────────────────────────────────────────────────────────

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}
