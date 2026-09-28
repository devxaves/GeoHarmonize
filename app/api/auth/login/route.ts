/**
 * BhoomiSetu — POST /api/auth/login
 * Email + password login, returns session cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
import { verifyPassword, createSession, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // Find user by email
    const { rows } = await query<{ id: string; email: string; password_hash: string; role: string; name: string | null }>(
      `SELECT id, email, password_hash, role, name FROM gh_users WHERE LOWER(email) = LOWER($1)`,
      [email.trim()]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const user = rows[0];

    if (!user.password_hash) {
      return NextResponse.json({ error: "Account has no password set. Please contact admin." }, { status: 400 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // Create session
    const token = await createSession(user.id);

    const response = NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });

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
    console.error("Login error:", err);
    return NextResponse.json({ error: err?.message || "Login failed." }, { status: 500 });
  }
}
