/**
 * GeoHarmonize — AlignmentDrawer Component
 *
 * Sub-panel used on /atlas and /admin to:
 * 1. Toggle MapLibre Draw polygon mode on the parent ParcelMap
 * 2. Accept a drag-dropped or file-browsed .geojson file as alignment input
 * 3. Show current alignment GeoJSON summary
 * 4. Trigger POST /api/parcels/intersect and display matched parcels
 */

"use client";

import { useRef, useState } from "react";
import type { Polygon, MultiPolygon, FeatureCollection } from "geojson";
import { Upload, LocateFixed, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";

export interface IntersectedParcel {
  id: string;
  ulpin: string;
  village: string | null;
  district: string | null;
  area_hectares: number | null;
  ownership_status: string;
  risk_score: number;
}

interface AlignmentDrawerProps {
  onAlignmentChange: (geojson: Polygon | MultiPolygon | null) => void;
  onIntersectResults?: (parcels: IntersectedParcel[]) => void;
  projectId?: string; // if set, saves alignment to the project
}

export default function AlignmentDrawer({
  onAlignmentChange,
  onIntersectResults,
  projectId,
}: AlignmentDrawerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [alignment, setAlignment] = useState<Polygon | MultiPolygon | null>(null);
  const [intersecting, setIntersecting] = useState(false);
  const [results, setResults] = useState<IntersectedParcel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function applyAlignment(geom: Polygon | MultiPolygon | null) {
    setAlignment(geom);
    setResults([]);
    setError(null);
    setSaved(false);
    onAlignmentChange(geom);
  }

  function parseGeoJSONFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        // Accept FeatureCollection (take first polygon feature) or bare Geometry/Feature
        let geom: Polygon | MultiPolygon | null = null;
        if (raw.type === "FeatureCollection") {
          const fc = raw as FeatureCollection;
          const polyFeature = fc.features.find(
            (f) =>
              f.geometry.type === "Polygon" ||
              f.geometry.type === "MultiPolygon"
          );
          if (polyFeature) geom = polyFeature.geometry as Polygon | MultiPolygon;
        } else if (raw.type === "Feature") {
          if (
            raw.geometry.type === "Polygon" ||
            raw.geometry.type === "MultiPolygon"
          ) {
            geom = raw.geometry as Polygon | MultiPolygon;
          }
        } else if (raw.type === "Polygon" || raw.type === "MultiPolygon") {
          geom = raw as Polygon | MultiPolygon;
        }

        if (!geom) {
          setError("File must contain a Polygon or MultiPolygon geometry.");
          return;
        }
        applyAlignment(geom);
      } catch {
        setError("Invalid GeoJSON file.");
      }
    };
    reader.readAsText(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseGeoJSONFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.name.endsWith(".geojson") || file?.name.endsWith(".json")) {
      parseGeoJSONFile(file);
    } else {
      setError("Drop a .geojson or .json file.");
    }
  }

  async function runIntersect() {
    if (!alignment) return;
    setIntersecting(true);
    setError(null);
    try {
      const res = await fetch("/api/parcels/intersect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alignment }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const parcels: IntersectedParcel[] = data.data ?? [];
      setResults(parcels);
      onIntersectResults?.(parcels);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIntersecting(false);
    }
  }

  async function saveAlignment() {
    if (!alignment || !projectId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alignment_geojson: alignment }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="font-semibold text-gray-800 flex items-center gap-1.5">
        <LocateFixed className="h-4 w-4 text-indigo-600" />
        Project Alignment
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
        }`}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" />
        <p className="text-xs text-gray-500">
          Drop <span className="font-medium">.geojson</span> or click to browse
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Or draw directly on the map</p>
        <input
          ref={fileRef}
          type="file"
          accept=".geojson,.json"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Alignment summary */}
      {alignment && (
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <div>
            <div className="text-xs font-medium text-indigo-700">
              {alignment.type} loaded
            </div>
            <div className="text-xs text-indigo-500">
              {alignment.type === "Polygon"
                ? `${alignment.coordinates[0].length} vertices`
                : `${alignment.coordinates.length} rings`}
            </div>
          </div>
          <button
            onClick={() => applyAlignment(null)}
            className="text-indigo-400 hover:text-indigo-700"
            title="Clear alignment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-red-600 bg-red-50 rounded-lg px-3 py-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={runIntersect}
          disabled={!alignment || intersecting}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {intersecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LocateFixed className="h-3.5 w-3.5" />
          )}
          Find Parcels
        </button>

        {projectId && alignment && (
          <button
            onClick={saveAlignment}
            disabled={saving || saved}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : null}
            {saved ? "Saved" : "Save to Project"}
          </button>
        )}
      </div>

      {/* Intersect results */}
      {results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 border-b">
            {results.length} intersecting parcel{results.length !== 1 ? "s" : ""}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {results.map((p) => (
              <div
                key={p.id}
                className="px-3 py-2 border-b last:border-0 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <div className="font-mono text-xs font-bold text-amber-700">
                    {p.ulpin}
                  </div>
                  <div className="text-xs text-gray-500">
                    {[p.village, p.district].filter(Boolean).join(", ")} ·{" "}
                    {p.area_hectares ? `${p.area_hectares} ha` : "—"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      p.ownership_status === "clear"
                        ? "bg-green-100 text-green-700"
                        : p.ownership_status === "disputed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {p.ownership_status}
                  </span>
                  <span
                    className="text-xs font-bold"
                    style={{
                      color:
                        Number(p.risk_score ?? 0) >= 70
                          ? "#ef4444"
                          : Number(p.risk_score ?? 0) >= 40
                          ? "#f59e0b"
                          : "#22c55e",
                    }}
                  >
                    Risk {Number(p.risk_score ?? 0).toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && alignment && !intersecting && (
        <p className="text-xs text-gray-400 text-center">
          Click "Find Parcels" to detect intersecting survey parcels
        </p>
      )}
    </div>
  );
}
