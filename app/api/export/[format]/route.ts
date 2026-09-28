/**
 * GeoHarmonize — GET /api/export/[format]
 * Proxies GeoJSON or GeoPackage exports from the geo-engine.
 */

import { NextRequest, NextResponse } from "next/server";

const GEO_ENGINE_URL = process.env.GEO_ENGINE_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ format: string }> }
) {
  try {
    const { format } = await params;
    const targetUrl = new URL(`${GEO_ENGINE_URL}/api/geo/export/${format}`);
    const { searchParams } = new URL(req.url);
    searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

    const resp = await fetch(targetUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ error: err }, { status: resp.status });
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const contentDisposition =
      resp.headers.get("content-disposition") ||
      `attachment; filename="geoharmonize_export.${format === "geopackage" ? "gpkg" : "geojson"}"`;

    const blob = await resp.arrayBuffer();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (err: any) {
    console.error("GET /api/export error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
