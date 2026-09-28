/**
 * BhoomiSetu — Documents Query Module (Raw SQL)
 * All document-related database operations.
 * Documents are created by the /api/upload pipeline after OCR + NER.
 */

import { query } from "../pool";
import type { NEREntity, ExtractedSummary } from "@/lib/ner";
export interface Discrepancy {
  field: string;
  severity: "info" | "warning" | "error";
  message: string;
  databaseValue?: string | number | null;
  documentValue?: string | number | null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  project_id: string | null;
  filename: string;
  doc_type: string | null;
  raw_ocr_text: string | null;
  ner_entities: NEREntity[] | null;
  discrepancy_flags: Discrepancy[] | null;
  created_at: string;
}

export interface DocumentInsert {
  project_id?: string | null;
  filename: string;
  doc_type?: string | null;
  raw_ocr_text?: string | null;
  ner_entities?: NEREntity[] | null;
  extracted_summary?: ExtractedSummary | null;
  discrepancy_flags?: Discrepancy[] | null;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Insert a new document record after OCR + NER processing.
 * ner_entities is stored as the full entity array.
 * extracted_summary is serialised inside ner_entities as a special entry.
 */
export async function createDocument(input: DocumentInsert): Promise<Document> {
  // Combine NER entities and extracted summary into a single JSONB payload
  const nerPayload = {
    entities: input.ner_entities ?? [],
    summary: input.extracted_summary ?? null,
  };

  const { rows } = await query<Document>(
    `INSERT INTO documents (project_id, filename, doc_type, raw_ocr_text, ner_entities, discrepancy_flags)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.project_id ?? null,
      input.filename,
      input.doc_type ?? null,
      input.raw_ocr_text ?? null,
      JSON.stringify(nerPayload),
      JSON.stringify(input.discrepancy_flags ?? []),
    ]
  );
  return rows[0];
}

/**
 * Fetch all documents for a project.
 */
export async function getDocumentsByProject(projectId: string): Promise<Document[]> {
  const { rows } = await query<Document>(
    `SELECT id, project_id, filename, doc_type, discrepancy_flags, created_at
     FROM documents WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId]
  );
  return rows;
}

/**
 * Fetch a single document by ID (includes full OCR text and NER).
 */
export async function getDocumentById(id: string): Promise<Document | null> {
  const { rows } = await query<Document>(
    `SELECT * FROM documents WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Update discrepancy_flags on an existing document
 * (e.g. when parcels are updated and discrepancies need re-evaluation).
 */
export async function updateDiscrepancyFlags(
  documentId: string,
  flags: Discrepancy[]
): Promise<void> {
  await query(
    `UPDATE documents SET discrepancy_flags = $1 WHERE id = $2`,
    [JSON.stringify(flags), documentId]
  );
}

/**
 * Get documents that have active error-level discrepancy flags.
 * Used by the dashboard to surface documents needing review.
 */
export async function getDocumentsWithErrors(projectId?: string): Promise<Document[]> {
  const where = projectId ? `WHERE project_id = $1 AND` : "WHERE";
  const params = projectId ? [projectId] : [];

  const { rows } = await query<Document>(
    `SELECT id, project_id, filename, doc_type, discrepancy_flags, created_at
     FROM documents
     ${where} jsonb_array_length(discrepancy_flags) > 0
     ORDER BY created_at DESC
     LIMIT 50`,
    params
  );
  return rows;
}

/**
 * Count documents grouped by doc_type for a project.
 */
export async function getDocumentStats(
  projectId: string
): Promise<{ doc_type: string; count: number }[]> {
  const { rows } = await query<{ doc_type: string; count: string }>(
    `SELECT COALESCE(doc_type, 'other') as doc_type, COUNT(*)::text as count
     FROM documents WHERE project_id = $1
     GROUP BY doc_type ORDER BY count DESC`,
    [projectId]
  );
  return rows.map((r) => ({ doc_type: r.doc_type, count: parseInt(r.count, 10) }));
}
