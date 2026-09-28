/**
 * BhoomiSetu — Current User Profile API
 * GET /api/me — returns the BhoomiSetu user record for the authenticated user
 * Used by /workflow page to determine role for stage-advance gating
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserById } from "@/lib/db/queries/users";

export async function GET(req: NextRequest) {
  const authUser = await getCurrentUser(req);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getUserById(authUser.id);

    if (!user) {
      return NextResponse.json({
        data: {
          id: authUser.id,
          email: authUser.email,
          role: authUser.role,
          name: authUser.name,
        },
      });
    }

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("GET /api/me error:", err);
    return NextResponse.json(
      { error: "Failed to fetch user profile", details: (err as Error).message },
      { status: 500 }
    );
  }
}
