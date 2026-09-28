/**
 * GeoHarmonize — POST /api/harmonize/[id]
 * Triggers matching + confidence scoring pipeline on an uploaded dataset.
 */

import { NextRequest, NextResponse } from "next/server";

const GEO_ENGINE_URL = process.env.GEO_ENGINE_URL || "http://localhost:8000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const targetUrl = new URL(`${GEO_ENGINE_URL}/api/geo/datasets/${id}/harmonize`);
    searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

    const resp = await fetch(targetUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json(
        { error: `Geo-engine returned ${resp.status}: ${err}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("POST /api/harmonize/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
