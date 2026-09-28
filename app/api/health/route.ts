/**
 * BhoomiSetu — Health Check API
 * GET /api/health
 * Verifies raw SQL pool connectivity to Neon PostgreSQL.
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';

export async function GET() {
  const start = Date.now();

  try {
    const { rows } = await query<{ now: string; version: string }>(
      `SELECT now()::text AS now, version() AS version`
    );

    const latencyMs = Date.now() - start;

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      latencyMs,
      serverTime: rows[0].now,
      pgVersion: rows[0].version.split(' ').slice(0, 2).join(' '),
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error('❌ Health check DB error:', err);

    return NextResponse.json(
      {
        status: 'error',
        db: 'unreachable',
        latencyMs,
        error: (err as Error).message,
      },
      { status: 503 }
    );
  }
}
