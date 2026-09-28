/**
 * BhoomiSetu — POST /api/auth/logout
 * Clears session cookie and deletes session from DB
 */

import { NextRequest, NextResponse } from "next/server";
import { deleteSession, clearSessionCookie, getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (user) {
      const token = req.cookies.get("geoharmonize_session")?.value;
      if (token) {
        await deleteSession(token);
      }
    }

    const response = NextResponse.json({ message: "Logged out successfully." });
    const cookie = clearSessionCookie();
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "Logout failed." }, { status: 500 });
  }
}
