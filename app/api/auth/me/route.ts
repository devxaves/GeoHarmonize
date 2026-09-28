/**
 * BhoomiSetu — GET /api/auth/me
 * Returns current logged-in user info from session cookie
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    return NextResponse.json({ data: user });
  } catch (err: any) {
    console.error("Auth check error:", err);
    return NextResponse.json({ error: "Failed to check auth." }, { status: 500 });
  }
}
