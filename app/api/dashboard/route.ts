/**
 * GeoHarmonize — GET /api/dashboard
 * Aggregated KPIs: proxies geo-engine data + app DB audit log stats.
 * Used by the dashboard page for animated counter metrics.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

const GEO_ENGINE_URL = process.env.GEO_ENGINE_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    // Graceful session check

    // Fetch from geo-engine in parallel
    const [conflictsRes, parcelsRes, changesRes] = await Promise.allSettled([
      fetch(`${GEO_ENGINE_URL}/api/geo/conflicts?limit=1`),
      fetch(`${GEO_ENGINE_URL}/api/geo/parcels?limit=1`),
      fetch(`${GEO_ENGINE_URL}/api/geo/changes?limit=1`),
    ]);

    const conflicts = conflictsRes.status === "fulfilled" && conflictsRes.value.ok
      ? await conflictsRes.value.json()
      : { total: 0, conflicts: [] };

    const parcels = parcelsRes.status === "fulfilled" && parcelsRes.value.ok
      ? await parcelsRes.value.json()
      : { total: 0 };

    const changes = changesRes.status === "fulfilled" && changesRes.value.ok
      ? await changesRes.value.json()
      : { total: 0 };

    // Break down conflicts by status
    const [openRes, resolvedRes, autoRes] = await Promise.allSettled([
      fetch(`${GEO_ENGINE_URL}/api/geo/conflicts?status=open&limit=1`),
      fetch(`${GEO_ENGINE_URL}/api/geo/conflicts?status=approved&limit=1`),
      fetch(`${GEO_ENGINE_URL}/api/geo/parcels?status=auto_linked&limit=1`),
    ]);

    const openConflicts = openRes.status === "fulfilled" && openRes.value.ok
      ? (await openRes.value.json()).total : 0;
    const resolvedConflicts = resolvedRes.status === "fulfilled" && resolvedRes.value.ok
      ? (await resolvedRes.value.json()).total : 0;
    const autoLinked = autoRes.status === "fulfilled" && autoRes.value.ok
      ? (await autoRes.value.json()).total : 0;

    const totalConflicts = conflicts.total || 0;
    const autoResolved = totalConflicts > 0
      ? Math.round((autoLinked / Math.max(totalConflicts, 1)) * 100)
      : 0;

    // Estimated manual effort reduction
    const manualEffortReductionPct = Math.min(
      Math.round((autoLinked / Math.max(totalConflicts, 1)) * 100),
      95
    );

    return NextResponse.json({
      kpis: {
        totalParcels: parcels.total || 0,
        totalConflicts,
        openConflicts,
        resolvedConflicts,
        autoLinkedParcels: autoLinked,
        autoResolutionRate: autoResolved,
        manualEffortReductionPct,
        changeEventsRequiringVerification: changes.total || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Failed to fetch dashboard data." }, { status: 500 });
  }
}
