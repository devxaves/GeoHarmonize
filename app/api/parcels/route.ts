/**
 * GeoSync — GET /api/parcels
 * Proxies parcel list queries to geo-engine.
 */

import { NextRequest, NextResponse } from "next/server";

const GEO_ENGINE_URL = process.env.GEO_ENGINE_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = new URL(`${GEO_ENGINE_URL}/api/geo/parcels`);
    searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    const resp = await fetch(targetUrl.toString(), {
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
    console.error("GET /api/parcels proxy error:", err);
    return NextResponse.json(
      { error: "Failed to connect to geo-engine service", details: err.message },
      { status: 503 }
    );
  }
}
