/**
 * GeoHarmonize — GET /api/parcels/[uid]
 * Proxies parcel details with version history from geo-engine.
 */

import { NextRequest, NextResponse } from "next/server";

const GEO_ENGINE_URL = process.env.GEO_ENGINE_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const resp = await fetch(`${GEO_ENGINE_URL}/api/geo/parcels/${encodeURIComponent(uid)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { error: `Geo-engine returned ${resp.status}: ${errText}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error(`GET /api/parcels/[uid] error:`, err);
    return NextResponse.json(
      { error: "Failed to connect to geo-engine service", details: err.message },
      { status: 503 }
    );
  }
}
