/**
 * BhoomiSetu — Document Retrieval API
 * GET /api/documents?project_id=  — list documents for a project
 * GET /api/documents/[id]         — fetch single document (separate route)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentsByProject, getDocumentsWithErrors } from "@/lib/db/queries/documents";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");
    const withErrors = searchParams.get("with_errors") === "true";

    if (withErrors) {
      const docs = await getDocumentsWithErrors(projectId ?? undefined);
      return NextResponse.json({ data: docs, count: docs.length });
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "project_id query param is required (or use ?with_errors=true)" },
        { status: 400 }
      );
    }

    const docs = await getDocumentsByProject(projectId);
    return NextResponse.json({ data: docs, count: docs.length });
  } catch (err) {
    console.error("GET /api/documents error:", err);
    return NextResponse.json(
      { error: "Failed to fetch documents", details: (err as Error).message },
      { status: 500 }
    );
  }
}
