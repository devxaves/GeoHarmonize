/**
 * BhoomiSetu — GET /api/mock/logs
 *
 * Retrieves recent mock adapter audit logs from the database for the admin console.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db/pool";

export interface MockLogEntry {
  id: string;
  source: string;
  request: any;
  response: any;
  called_at: string;
}

export async function GET() {
  try {
    const { rows } = await query<MockLogEntry>(
      `SELECT * FROM mock_adapter_log ORDER BY called_at DESC LIMIT 25`
    );
    return NextResponse.json({
      success: true,
      count: rows.length,
      logs: rows,
    });
  } catch (error: any) {
    console.error("🔴 Error in /api/mock/logs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch mock adapter logs." },
      { status: 500 }
    );
  }
}
