/**
 * BhoomiSetu — GET /api/dashboard/analytics
 *
 * Returns aggregated executive metrics, status distributions, district compliance,
 * and monthly trajectory trends computed via hand-written SQL.
 */

import { NextResponse } from "next/server";
import { getExecutiveDashboardStats } from "@/lib/db/queries/dashboard";

export async function GET() {
  try {
    const stats = await getExecutiveDashboardStats();
    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error: any) {
    console.error("🔴 Error in /api/dashboard/analytics:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch dashboard analytics." },
      { status: 500 }
    );
  }
}
