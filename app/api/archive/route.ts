import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "15", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    const resp = await fetch(`${process.env.GEO_ENGINE_URL}/api/geo/parcels?${params}`);
    const data = await resp.json();

    return NextResponse.json({
      success: true,
      total: data.total || 0,
      parcels: data.parcels || [],
    });
  } catch (error: any) {
    console.error("Error in /api/archive:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch archive." },
      { status: 500 }
    );
  }
}
