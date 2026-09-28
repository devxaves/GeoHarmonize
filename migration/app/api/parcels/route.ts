/**
 * BhoomiSetu — Parcels API
 * GET  /api/parcels  — list/search parcels (supports ?ulpin=, ?project_id=, ?district=)
 * POST /api/parcels  — create a new parcel record (requires auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth";
import {
  listParcels,
  listParcelsForMap,
  getParcelByUlpin,
  createParcel,
  type CreateParcelInput,
} from '@/lib/db/queries/parcels';

// ── GET /api/parcels ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);

    // ULPIN direct lookup (returns full parcel with geometry)
    const ulpin = searchParams.get('ulpin');
    if (ulpin) {
      const parcel = await getParcelByUlpin(ulpin.trim());
      if (!parcel) {
        return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
      }
      return NextResponse.json({ data: parcel });
    }

    const project_id = searchParams.get('project_id') ?? undefined;
    const district   = searchParams.get('district')   ?? undefined;
    const state      = searchParams.get('state')      ?? undefined;

    // Map mode: returns parcels WITH geometry for polygon rendering on the map
    const geometryMode = searchParams.get('geometry') === 'true';
    if (geometryMode) {
      const parcels = await listParcelsForMap({ project_id, district, state });
      return NextResponse.json({ data: parcels, count: parcels.length });
    }

    // Filtered list with pagination (returns lightweight summaries without geometry)
    const ownership_status = searchParams.get('ownership_status') ?? undefined;
    const page             = searchParams.get('page')             ? parseInt(searchParams.get('page')!, 10) : undefined;
    const limit            = searchParams.get('limit')            ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const result = await listParcels(
      { project_id, district, state, ownership_status },
      { page, limit }
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/parcels error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch parcels' },
      { status: 500 }
    );
  }
}

// ── POST /api/parcels ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Partial<CreateParcelInput>;

    if (!body.ulpin) {
      return NextResponse.json({ error: 'Missing required field: ulpin' }, { status: 400 });
    }
    if (!body.geometry_geojson) {
      return NextResponse.json({ error: 'Missing required field: geometry_geojson' }, { status: 400 });
    }

    const parcel = await createParcel(body as CreateParcelInput);
    return NextResponse.json({ data: parcel }, { status: 201 });
  } catch (err) {
    console.error('POST /api/parcels error:', err);
    const msg = (err as Error).message;
    if (msg.includes('parcels_ulpin_key') || msg.includes('unique')) {
      return NextResponse.json({ error: 'A parcel with this ULPIN already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to create parcel' },
      { status: 500 }
    );
  }
}
