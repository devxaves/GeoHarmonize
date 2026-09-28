/**
 * BhoomiSetu — POST /api/risk/compute
 *
 * Computes explainable risk score for a project or parcel, persists to risk_scores
 * table, and updates entity risk_score column.
 *
 * Request Body:
 * {
 *   entityType: 'project' | 'parcel',
 *   entityId: string,
 *   weights?: Partial<RiskRuleWeights>,
 *   persist?: boolean
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { computeEntityRisk, type RiskRuleWeights } from "@/lib/risk-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entityType, entityId, weights, persist } = body;

    if (!entityType || !["project", "parcel"].includes(entityType)) {
      return NextResponse.json(
        { error: "Invalid entityType. Must be 'project' or 'parcel'." },
        { status: 400 }
      );
    }

    if (!entityId || typeof entityId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid entityId." },
        { status: 400 }
      );
    }

    const result = await computeEntityRisk(entityType, entityId, {
      weights: weights as Partial<RiskRuleWeights>,
      persist: persist !== false,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("🔴 Error in /api/risk/compute:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to compute risk score." },
      { status: 500 }
    );
  }
}
