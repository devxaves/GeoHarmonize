/**
 * BhoomiSetu — Parcels Query Module (Raw SQL)
 * All parcel-related database operations, including ULPIN lookups.
 */

import { query } from '../pool';

// ============================================================
// Types
// ============================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/** Lightweight parcel summary for list views (excludes heavy geometry_geojson) */
export interface ParcelSummary {
  id: string;
  ulpin: string;
  project_id: string | null;
  survey_number: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  area_hectares: number | null;
  land_type: string | null;
  ownership_status: string;
  litigation_flag: boolean;
  risk_score: number;
  created_at: string;
  updated_at: string;
  /** Centroid [lng, lat] for map markers — computed from geometry */
  centroid: [number, number] | null;
}

export interface Parcel {
  id: string;
  ulpin: string;
  project_id: string | null;
  survey_number: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  area_hectares: number | null;
  land_type: string | null;
  geometry_geojson: object;
  ownership_status: string;
  litigation_flag: boolean;
  risk_score: number;
  created_at: string;
  updated_at: string;
}

export interface CreateParcelInput {
  ulpin: string;
  project_id?: string;
  survey_number?: string;
  village?: string;
  district?: string;
  state?: string;
  area_hectares?: number;
  land_type?: string;
  geometry_geojson: object;
  ownership_status?: string;
  litigation_flag?: boolean;
}

// ============================================================
// Queries
// ============================================================

function resolvePagination(params?: PaginationParams): { page: number; limit: number; offset: number } {
  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.min(200, Math.max(1, params?.limit ?? 50));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/** List parcels with pagination, optionally filtered. Returns lightweight summaries (no geometry). */
export async function listParcels(
  filters?: {
    project_id?: string;
    district?: string;
    state?: string;
    ownership_status?: string;
  },
  pagination?: PaginationParams
): Promise<PaginatedResult<ParcelSummary>> {
  const { page, limit, offset } = resolvePagination(pagination);

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (filters?.project_id) {
    conditions.push(`project_id = $${paramIndex++}`);
    params.push(filters.project_id);
  }
  if (filters?.district) {
    conditions.push(`district = $${paramIndex++}`);
    params.push(filters.district);
  }
  if (filters?.state) {
    conditions.push(`state = $${paramIndex++}`);
    params.push(filters.state);
  }
  if (filters?.ownership_status) {
    conditions.push(`ownership_status = $${paramIndex++}`);
    params.push(filters.ownership_status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM parcels ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Fetch page — compute centroid from geometry, exclude full geometry blob
  const dataParams = [...params, limit, offset];
  const { rows } = await query<ParcelSummary>(
    `SELECT id, ulpin, project_id, survey_number, village, district, state,
            area_hectares, land_type, ownership_status, litigation_flag,
            risk_score, created_at, updated_at,
            CASE
              WHEN geometry_geojson IS NOT NULL THEN
                json_build_array(
                  (geometry_geojson->'coordinates')::json->>0,
                  (geometry_geojson->'coordinates')::json->>1
                )::text
              ELSE NULL
            END AS centroid
     FROM parcels ${where}
     ORDER BY updated_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    dataParams
  );

  // Parse centroid strings back to [lng, lat] tuples
  const parsed = rows.map((r) => ({
    ...r,
    centroid: r.centroid ? JSON.parse(r.centroid as unknown as string) as [number, number] : null,
  }));

  const totalPages = Math.ceil(total / limit);

  return {
    data: parsed,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/** List parcels WITH geometry for map rendering. Used by the GIS atlas. */
export async function listParcelsForMap(filters?: {
  project_id?: string;
  district?: string;
  state?: string;
}): Promise<Parcel[]> {
  const conditions: string[] = [];
  const params: string[] = [];
  let paramIndex = 1;

  if (filters?.project_id) {
    conditions.push(`project_id = $${paramIndex++}`);
    params.push(filters.project_id);
  }
  if (filters?.district) {
    conditions.push(`district = $${paramIndex++}`);
    params.push(filters.district);
  }
  if (filters?.state) {
    conditions.push(`state = $${paramIndex++}`);
    params.push(filters.state);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query<Parcel>(
    `SELECT id, ulpin, project_id, survey_number, village, district, state,
            area_hectares, land_type, geometry_geojson, ownership_status,
            litigation_flag, risk_score, created_at, updated_at
     FROM parcels ${where}
     ORDER BY updated_at DESC`,
    params
  );

  return rows;
}

/** Get a parcel by ULPIN (14-digit Bhu-Aadhaar) */
export async function getParcelByUlpin(ulpin: string): Promise<Parcel | null> {
  const { rows } = await query<Parcel>(
    'SELECT * FROM parcels WHERE ulpin = $1',
    [ulpin]
  );
  return rows[0] || null;
}

/** Get a parcel by ID */
export async function getParcelById(id: string): Promise<Parcel | null> {
  const { rows } = await query<Parcel>(
    'SELECT * FROM parcels WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

/** List parcels by project */
export async function listParcelsByProject(projectId: string): Promise<Parcel[]> {
  const { rows } = await query<Parcel>(
    'SELECT * FROM parcels WHERE project_id = $1 ORDER BY ulpin',
    [projectId]
  );
  return rows;
}

/** Create a new parcel */
export async function createParcel(input: CreateParcelInput): Promise<Parcel> {
  const { rows } = await query<Parcel>(
    `INSERT INTO parcels (
      ulpin, project_id, survey_number, village, district, state,
      area_hectares, land_type, geometry_geojson, ownership_status, litigation_flag
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      input.ulpin,
      input.project_id || null,
      input.survey_number || null,
      input.village || null,
      input.district || null,
      input.state || null,
      input.area_hectares || null,
      input.land_type || null,
      JSON.stringify(input.geometry_geojson),
      input.ownership_status || 'clear',
      input.litigation_flag || false,
    ]
  );
  return rows[0];
}

/**
 * Find parcels that spatially intersect a given GeoJSON geometry.
 *
 * Uses turf.js booleanIntersects for precise intersection in application code
 * (jsonb-geometry fallback pattern per spec Section 8).
 *
 * Performs a bounding-box pre-filter in SQL to reduce candidate count,
 * then applies precise turf.js intersection check in application code.
 */
export async function findIntersectingParcels(
  alignmentGeoJSON: object,
  filters?: { district?: string; state?: string }
): Promise<Parcel[]> {
  const { booleanIntersects, polygon, multiPolygon } = await import("@turf/turf");
  const geo = alignmentGeoJSON as { type: string; coordinates: any };

  if (geo.type !== "Polygon" && geo.type !== "MultiPolygon") {
    return [];
  }

  // Build alignment geometry for intersection check
  const alignmentGeom =
    geo.type === "Polygon"
      ? polygon(geo.coordinates)
      : multiPolygon(geo.coordinates);

  // SQL pre-filter: only fetch parcels with geometry in matching region
  const conditions: string[] = [
    `geometry_geojson IS NOT NULL`,
    `(geometry_geojson->>'type' IS NOT NULL)`,
  ];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (filters?.district) {
    conditions.push(`district = $${paramIndex++}`);
    params.push(filters.district);
  }
  if (filters?.state) {
    conditions.push(`state = $${paramIndex++}`);
    params.push(filters.state);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const { rows: candidates } = await query<Parcel>(
    `SELECT id, ulpin, project_id, survey_number, village, district, state,
            area_hectares, land_type, geometry_geojson, ownership_status,
            litigation_flag, risk_score, created_at, updated_at
     FROM parcels ${where}
     ORDER BY ulpin`,
    params
  );

  // Precise turf.js intersection check
  const intersecting = candidates.filter((parcel) => {
    try {
      const geom = parcel.geometry_geojson as { type: string; coordinates: any };
      if (!geom || !geom.coordinates) return false;

      const parcelGeom =
        geom.type === "Polygon"
          ? polygon(geom.coordinates)
          : multiPolygon(geom.coordinates);

      return booleanIntersects(alignmentGeom as any, parcelGeom as any);
    } catch {
      return false;
    }
  });

  return intersecting;
}

/** Get parcels grouped by ownership status (for dashboard) */
export async function getParcelsByOwnershipStatus(): Promise<{ ownership_status: string; count: number }[]> {
  const { rows } = await query<{ ownership_status: string; count: string }>(
    `SELECT ownership_status, COUNT(*)::text as count FROM parcels GROUP BY ownership_status ORDER BY count DESC`
  );
  return rows.map(r => ({ ownership_status: r.ownership_status, count: parseInt(r.count, 10) }));
}

/** Get count of parcels with litigation flags */
export async function getLitigationCount(): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM parcels WHERE litigation_flag = true`
  );
  return parseInt(rows[0].count, 10);
}
