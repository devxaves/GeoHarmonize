import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const changeType = searchParams.get("change_type") || undefined;

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (changeType) params.set("change_type", changeType);

    const resp = await fetch(`${process.env.GEO_ENGINE_URL}/api/geo/changes?${params}`);
    const data = await resp.json();

    return NextResponse.json({
      success: true,
      total: data.total || 0,
      changes: data.changes || [],
    });
  } catch (error: any) {
    console.error("Error in /api/changes:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch changes." },
      { status: 500 }
    );
  }
}
