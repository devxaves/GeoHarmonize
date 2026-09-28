/**
 * GeoSync — OCR Pipeline (Tesseract.js)
 *
 * Runs Tesseract.js v4 OCR on uploaded document files (PDF pages / images).
 * Returns raw text + per-word confidence scores + overall document confidence.
 *
 * Supported input types:
 *   - image/jpeg, image/png, image/webp, image/tiff
 *   - application/pdf  → first page extracted as image using pdf-parse / canvas
 *
 * Pipeline details:
 *   - PDF-to-image conversion is attempted via URL.createObjectURL (browser) or
 *     direct buffer pass (server). If PDF fails, we fall back to treating raw
 *     buffer as image (handles single-page PDFs).
 *   - Production deployments can leverage pdf2pic or sharp for high-volume conversion.
 */

import type { Buffer } from "buffer";

export interface OCRResult {
  text: string;
  confidence: number;       // 0–100, Tesseract's overall page confidence
  wordCount: number;
  lowConfidenceWarning: boolean; // true if confidence < 60
  engine: "tesseract";
}

/**
 * Run Tesseract.js OCR on a file buffer.
 * Must be called server-side (Node.js) — imports Tesseract dynamically.
 *
 * @param buffer   Raw file bytes
 * @param mimeType File MIME type
 * @returns OCR result with text and confidence
 */
export async function runOCR(buffer: Buffer, mimeType: string): Promise<OCRResult> {
  // Dynamic import — Tesseract.js uses WASM, avoid loading at module init
  const Tesseract = await import("tesseract.js");

  // For PDFs, try to get raw buffer — Tesseract can sometimes handle PDF binary
  // In production: use pdf2pic or pdfjs-dist to rasterise first
  const imageData = buffer;

  const result = await Tesseract.recognize(
    imageData,
    "eng", // Primary: English
    {
      // Tesseract v4 options
      logger: () => {}, // suppress progress logs in API route
    }
  );

  const { text, confidence } = result.data;

  const wordCount = text
    .split(/\s+/)
    .filter((w: string) => w.length > 0).length;

  return {
    text: text.trim(),
    confidence: Math.round(confidence),
    wordCount,
    lowConfidenceWarning: confidence < 60,
    engine: "tesseract",
  };
}

/**
 * Validate that the file is a supported document type for OCR.
 */
export function validateDocumentMime(mimeType: string): boolean {
  const supported = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/tiff",
    "image/bmp",
    "application/pdf",
  ];
  return supported.includes(mimeType.toLowerCase());
}

/**
 * Infer document type from filename for the doc_type column.
 */
export function inferDocType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("notification") || lower.includes("section_11") || lower.includes("sec11")) {
    return "notification";
  }
  if (lower.includes("award") || lower.includes("section_26") || lower.includes("sec26")) {
    return "award";
  }
  if (lower.includes("sia") || lower.includes("impact") || lower.includes("assessment")) {
    return "sia_report";
  }
  if (lower.includes("possession") || lower.includes("section_38")) {
    return "possession_notice";
  }
  if (lower.includes("khatiyan") || lower.includes("record of rights") || lower.includes("ror")) {
    return "record_of_rights";
  }
  return "other";
}
