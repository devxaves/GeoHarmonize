/**
 * GeoHarmonize — POST /api/auth/register
 * User registration (default role: viewer)
 * Admin can upgrade role via direct DB change.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
import { hashPassword, createSession, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Check if email already exists
    const { rows: existing } = await query<{ id: string }>(
      `SELECT id FROM gh_users WHERE LOWER(email) = LOWER($1)`,
      [email.trim()]
    );

    if (existing.length > 0) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    // Create user (default role: viewer — admin must promote to reviewer/admin)
    const passwordHash = await hashPassword(password);
    const { rows } = await query<{ id: string; email: string; role: string; name: string | null }>(
      `INSERT INTO gh_users (email, password_hash, role, name)
       VALUES ($1, $2, 'viewer', $3)
       RETURNING id, email, role, name`,
      [email.trim(), passwordHash, name?.trim() || null]
    );

    const user = rows[0];

    // Auto-login after registration
    const token = await createSession(user.id);

    const response = NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    }, { status: 201 });

    const cookie = sessionCookieOptions(token);
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: cookie.maxAge,
    });

    return response;
  } catch (err: any) {
    console.error("Register error:", err);
    return NextResponse.json({ error: err?.message || "Registration failed." }, { status: 500 });
  }
}
