/**
 * BhoomiSetu — Projects API
 * GET  /api/projects  — list projects (filterable by district, stage, status_flag)
 * POST /api/projects  — create a new acquisition project (requires auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth";
import { listProjects, createProject, type CreateProjectInput } from '@/lib/db/queries/projects';

// ── GET /api/projects ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const district    = searchParams.get('district')    ?? undefined;
    const state       = searchParams.get('state')       ?? undefined;
    const status_flag = searchParams.get('status_flag') ?? undefined;
    const search      = searchParams.get('search')      ?? undefined;
    const page        = searchParams.get('page')        ? parseInt(searchParams.get('page')!, 10) : undefined;
    const limit       = searchParams.get('limit')       ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const result = await listProjects(
      { district, state, status_flag, search },
      { page, limit }
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/projects error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// ── POST /api/projects ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Partial<CreateProjectInput>;

    const required = ['name', 'land_requiring_body', 'state', 'district'] as const;
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const project = await createProject(body as CreateProjectInput);

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects error:', err);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
