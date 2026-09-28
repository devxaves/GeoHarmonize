"use client";

/**
 * GeoHarmonize — Multi-Source Geospatial Ingestion & Harmonization Trigger (/upload)
 *
 * Implements PRD §6.1, §6.2, §6.8, §9 (Phase 2 & Phase 4):
 * - Multi-source ingestion (Drone ORI, Cadastral, Scanned Revenue Maps, GNSS)
 * - CRS detection & transformation feedback (always logged, never silent)
 * - Topology validation report (ST_MakeValid, slivers, gaps)
 * - Direct "Harmonize Dataset" trigger
 * - "One-Click Demo Flow" runner (PRD §13)
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Upload,
  FileCheck,
  Compass,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Download,
  Info,
  Play,
  RotateCcw,
} from "lucide-react";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<string>("cadastral");
  const [declaredCrs, setDeclaredCrs] = useState<string>("EPSG:4326");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [isHarmonizing, setIsHarmonizing] = useState(false);
  const [harmonizeResult, setHarmonizeResult] = useState<any>(null);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [demoResult, setDemoResult] = useState<any>(null);

  // OCR/NER state
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [nerEntities, setNerEntities] = useState<any[]>([]);
  const [nerSummary, setNerSummary] = useState<any>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [isProcessingNer, setIsProcessingNer] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadResult(null);
      setHarmonizeResult(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source_type", sourceType);
      formData.append("declared_crs", declaredCrs);

      const resp = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await resp.json();
      setUploadResult(data);
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleHarmonize = async () => {
    if (!uploadResult?.dataset_id) return;
    setIsHarmonizing(true);
    try {
      const resp = await fetch(
        `/api/harmonize/${uploadResult.dataset_id}?state=MH&district=PUNE&ulb=PMC&ward=W01`,
        { method: "POST" }
      );
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Harmonization failed");
      }
      const data = await resp.json();
      setHarmonizeResult(data);
    } catch (err: any) {
      alert(`Harmonization error: ${err.message}`);
    } finally {
      setIsHarmonizing(false);
    }
  };

  const handleRunDemoFlow = async () => {
    setIsSeedingDemo(true);
    setDemoResult(null);
    try {
      const resp = await fetch("/api/demo/seed", { method: "POST" });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Demo seeding failed");
      }
      const data = await resp.json();
      setDemoResult(data);
    } catch (err: any) {
      alert(`Demo flow error: ${err.message}`);
    } finally {
      setIsSeedingDemo(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 font-sans"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5"
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            DoLR Geospatial Ingestion Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-heading">
            Multi-Source Land Record Ingestion
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Ingest messy cadastral maps, drone imagery (ORI), municipal GIS layers, and scanned revenue records into PostGIS with automated CRS detection and topology repair.
          </p>
        </div>

        {/* Quick Demo CTA */}
        <div className="bg-orange-50/80 border border-orange-200 p-3 rounded-2xl flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-600 text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">SIH Evaluator Demo Flow</div>
            <div className="text-[11px] text-slate-500">Seed sample cadastral + drone discrepancy layers</div>
          </div>
          <button
            onClick={handleRunDemoFlow}
            disabled={isSeedingDemo}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSeedingDemo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run 1-Click Demo
          </button>
        </div>
      </motion.div>

      {/* Demo Seed Result Banner */}
      {demoResult && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Demo Flow Executed Successfully! (PRD §13 Completed)
            </div>
            <button
              onClick={() => router.push("/atlas")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-all"
            >
              Open Web-GIS Review Atlas
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-100">
              <span className="text-slate-500">Baseline Cadastral:</span>
              <div className="font-bold text-slate-800">{demoResult.dataset_a.features} parcels inserted</div>
              <div className="text-[10px] text-slate-400 font-mono">CRS: {demoResult.dataset_a.crs.method}</div>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-100">
              <span className="text-slate-500">Drone Survey:</span>
              <div className="font-bold text-slate-800">{demoResult.dataset_b.features} features matched</div>
              <div className="text-[10px] text-slate-400">Drift & typos detected</div>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-100">
              <span className="text-slate-500">Discrepancies Flagged:</span>
              <div className="font-bold text-orange-600">{demoResult.dataset_b.conflicts_generated} conflicts generated</div>
              <div className="text-[10px] text-slate-400">{demoResult.dataset_b.auto_linked} auto-linked · {demoResult.dataset_b.flagged_for_review} for review</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Ingestion Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleUpload} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Source Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Source Layer Type (PRD §4.2)
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-orange-500"
                >
                  <option value="cadastral">Cadastral Revenue Map (Vector / GeoJSON)</option>
                  <option value="drone_ori">Drone Orthorectified Imagery (ORI / Vector)</option>
                  <option value="municipal">Municipal GIS Tax Cadastre</option>
                  <option value="gnss">GNSS Survey Points (CORS / Rover)</option>
                  <option value="revenue">Scanned Revenue Record (Khatiyan / RoR)</option>
                  <option value="building_footprint">Extracted Building Footprints (CV / SAM)</option>
                </select>
              </div>

              {/* Declared CRS */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Declared / Source CRS (PRD §6.1)
                </label>
                <select
                  value={declaredCrs}
                  onChange={(e) => setDeclaredCrs(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-orange-500"
                >
                  <option value="EPSG:4326">EPSG:4326 (WGS 84 - Standard Lat/Lng)</option>
                  <option value="EPSG:7755">EPSG:7755 (India National Grid System)</option>
                  <option value="EPSG:32643">EPSG:32643 (UTM Zone 43N - Western India)</option>
                  <option value="EPSG:32644">EPSG:32644 (UTM Zone 44N - Central India)</option>
                  <option value="auto">Auto-detect from file header</option>
                </select>
              </div>
            </div>

            {/* Drop Zone */}
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-orange-400 transition-colors bg-slate-50/50">
              <input
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                accept=".geojson,.json,.gpkg,.shp,.kml,.tif,.png,.jpg,.jpeg,.pdf"
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  {file ? file.name : "Click to select or drag and drop geospatial file"}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  GeoJSON, Shapefile zip, GeoPackage, GeoTIFF, or Scanned Record (up to 50MB)
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                All uploads are transformed to EPSG:4326 and logged in the immutable audit trail.
              </div>
              <button
                type="submit"
                disabled={!file || isUploading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload & Validate Dataset
              </button>
            </div>
          </form>

          {/* Upload Results & Transformation Summary */}
          {uploadResult && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  Dataset Processed: {uploadResult.original_filename}
                </div>
                <span className="text-xs font-mono text-slate-400">{uploadResult.dataset_id}</span>
              </div>

              {/* CRS & Accuracy Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block mb-0.5">CRS Transformation:</span>
                  <strong className="text-slate-800">
                    {uploadResult.crs_transformation?.source_crs} → {uploadResult.crs_transformation?.target_crs}
                  </strong>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                    Method: {uploadResult.crs_transformation?.method}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block mb-0.5">Feature Count:</span>
                  <strong className="text-slate-800 font-mono text-base">{uploadResult.feature_count}</strong>
                  <span className="text-[10px] text-slate-500 block">polygons extracted</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block mb-0.5">Horizontal Accuracy:</span>
                  <strong className="text-slate-800">±{uploadResult.crs_transformation?.horizontal_accuracy_m}m</strong>
                  <span className="text-[10px] text-slate-500 block">estimated RMS error</span>
                </div>
              </div>

              {/* Topology Report */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-orange-600" />
                  Topology Validation Report (ST_MakeValid):
                </div>
                <div className="text-slate-600">
                  {uploadResult.validation_summary?.valid_features} of {uploadResult.feature_count} geometries valid.{" "}
                  {uploadResult.validation_summary?.slivers_detected || 0} slivers repaired.
                </div>
              </div>

              {/* Harmonize Trigger Action */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleHarmonize}
                  disabled={isHarmonizing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isHarmonizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
                  Trigger Harmonization & Spatial Matching
                </button>

                {harmonizeResult && (
                  <button
                    onClick={() => router.push("/atlas")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    View in Review Atlas
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {harmonizeResult && (
                <div className="p-3 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200 text-xs space-y-1">
                  <div className="font-bold">Harmonization Completed:</div>
                  <div>
                    Parcels Processed: {harmonizeResult.parcels_processed} · Conflicts Generated:{" "}
                    <strong>{harmonizeResult.conflicts_generated}</strong> · Auto-Linked: {harmonizeResult.auto_linked}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ingestion Info Panel (1 col) */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-orange-600" />
              DoLR Harmonization Rules
            </h2>
            <ul className="text-xs text-slate-600 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Confidence ≥ 90%:</strong> Automatically linked to cadastral baseline (reversible).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Confidence 60–89%:</strong> Routed to human reviewer in Web-GIS queue.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <RotateCcw className="w-3.5 h-3.5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Append-Only:</strong> Parcels are never deleted; version incremented upon approval.
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-900 text-slate-300 p-5 rounded-2xl shadow-sm text-xs space-y-2">
            <div className="text-white font-bold flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-amber-400" />
              Supported CRS Projections
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              GeoHarmonize automatically validates coordinate systems against EPSG Registry definitions. Source CRS transformations are recorded permanently in metadata with estimated horizontal uncertainty.
            </p>
          </div>

          {/* ── OCR / NER Section ─────────────────────────────────────────── */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-orange-600" />
              OCR & NER — Scanned Revenue Record Digitization
            </h2>
            <p className="text-xs text-slate-500">
              Upload a scanned revenue record (Khatiyan / RoR) to extract structured fields using OCR and NER.
            </p>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-orange-400 transition-colors bg-slate-50/50">
              <input
                type="file"
                id="ocr-file-upload"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setOcrFile(e.target.files[0]);
                    setOcrText("");
                    setNerEntities([]);
                    setNerSummary(null);
                  }
                }}
                accept=".png,.jpg,.jpeg,.tiff,.bmp,.pdf"
                className="hidden"
              />
              <label htmlFor="ocr-file-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  {ocrFile ? ocrFile.name : "Click to select scanned document"}
                </span>
                <span className="text-xs text-slate-400 mt-1">PNG, JPEG, TIFF, BMP (up to 10MB)</span>
              </label>
            </div>

            {ocrFile && (
              <button
                onClick={async () => {
                  setIsProcessingOcr(true);
                  try {
                    const formData = new FormData();
                    formData.append("file", ocrFile);
                    const resp = await fetch("/api/ocr", { method: "POST", body: formData });
                    const data = await resp.json();
                    if (resp.ok) {
                      setOcrText(data.text);
                      // Auto-run NER after OCR
                      setIsProcessingNer(true);
                      const nerResp = await fetch("/api/ner", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: data.text }),
                      });
                      const nerData = await nerResp.json();
                      if (nerResp.ok) {
                        setNerEntities(nerData.entities || []);
                        setNerSummary(nerData.summary || null);
                        const fields: Record<string, string> = {};
                        for (const e of nerData.entities || []) {
                          fields[e.type] = e.value;
                        }
                        setEditedFields(fields);
                      }
                      setIsProcessingNer(false);
                    } else {
                      alert(data.error || "OCR failed");
                    }
                  } catch (err: any) {
                    alert(`OCR error: ${err.message}`);
                  } finally {
                    setIsProcessingOcr(false);
                    setIsProcessingNer(false);
                  }
                }}
                disabled={isProcessingOcr}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isProcessingOcr ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isProcessingOcr ? "Processing OCR..." : "Run OCR + NER"}
              </button>
            )}

            {ocrText && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Extracted Text</div>
                <pre className="text-xs text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto">{ocrText.slice(0, 500)}</pre>
              </div>
            )}

            {nerEntities.length > 0 && (
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Extracted Fields (editable)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {nerEntities.map((entity, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{entity.type.replace(/_/g, " ")}</span>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                          entity.confidence >= 0.9
                            ? "bg-emerald-100 text-emerald-800"
                            : entity.confidence >= 0.75
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}>
                          {(entity.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="text"
                        value={editedFields[entity.type] || entity.value}
                        onChange={(e) =>
                          setEditedFields((prev) => ({ ...prev, [entity.type]: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                  ))}
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-transform active:scale-95 cursor-pointer">
                  <CheckCircle2 className="w-4 h-4" />
                  Submit Corrected Fields to Matching Pipeline
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
