/**
 * BhoomiSetu — MiniMapPolygon Component
 *
 * Custom polygon-drawing tool for admin geometry entry.
 * No MapboxDraw dependency — uses native MapLibre click events.
 * Features:
 * - Nominatim India geocoder search
 * - Click-to-place polygon vertices
 * - Real-time polygon preview
 * - Auto-zoom to drawn geometry
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { Polygon } from "geojson";
import { PenLine, Trash2, CheckCircle2, Search, MapPin, Undo2 } from "lucide-react";

// Simple bbox computation — avoids turf dynamic import chunk errors
function computeBbox(coords: [number, number][]): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

interface MiniMapPolygonProps {
  value?: Polygon | null;
  onChange: (geojson: Polygon | null) => void;
  height?: number;
}

export default function MiniMapPolygon({ value, onChange, height = 320 }: MiniMapPolygonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasGeom, setHasGeom] = useState(!!value);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ label: string; coordinates: [number, number] }[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Refs for points so click handler always sees latest
  const pointsRef = useRef<[number, number][]>([]);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("maplibre-gl").then((maplibre) => {
      const { Map, NavigationControl, Marker, Popup } = maplibre;

      const map = new Map({
        container: containerRef.current!,
        style: {
          version: 8 as const,
          sources: {
            osm: {
              type: "raster" as const,
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap",
            },
          },
          layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
        },
        center: [78.9629, 20.5937],
        zoom: 5,
        attributionControl: false,
      });

      map.addControl(new NavigationControl({ showCompass: false }), "top-right");

      // Store refs for search
      (map as any).__Marker = Marker;
      (map as any).__Popup = Popup;
      (map as any).__currentMarker = null;

      map.on("load", () => {
        // Add empty source + layers for polygon drawing
        map.addSource("draw-poly", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addSource("draw-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addSource("draw-preview", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "draw-poly-fill",
          type: "fill",
          source: "draw-poly",
          paint: { "fill-color": "#f59e0b", "fill-opacity": 0.25 },
        });
        map.addLayer({
          id: "draw-poly-stroke",
          type: "line",
          source: "draw-poly",
          paint: { "line-color": "#f59e0b", "line-width": 2 },
        });
        map.addLayer({
          id: "draw-preview-fill",
          type: "fill",
          source: "draw-preview",
          paint: { "fill-color": "#f59e0b", "fill-opacity": 0.15 },
        });
        map.addLayer({
          id: "draw-preview-stroke",
          type: "line",
          source: "draw-preview",
          paint: { "line-color": "#f59e0b", "line-width": 2, "line-dasharray": [3, 2] },
        });
        map.addLayer({
          id: "draw-points",
          type: "circle",
          source: "draw-points",
          paint: {
            "circle-radius": 6,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          },
        });

        // Add existing value if present
        if (value) {
          const coords = value.coordinates[0] as [number, number][];
          pointsRef.current = coords.slice(0, -1); // Remove closing point
          setPoints(pointsRef.current);
          setHasGeom(true);
          updateDrawLayers(map, pointsRef.current, true);
          // Fit bounds
          const ring = value.coordinates[0] as [number, number][];
          const b = computeBbox(ring);
          map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40 });
        }

        setLoaded(true);
      });

      // Click handler for placing points
      map.on("click", (e: MapMouseEvent) => {
        if (!drawingRef.current) return;
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const pts = [...pointsRef.current, coords];
        pointsRef.current = pts;
        setPoints([...pts]);
        updateDrawLayers(map, pts, false);
      });

      // Cursor change in draw mode
      map.on("mouseenter", "draw-poly-fill", () => {
        if (drawingRef.current) map.getCanvas().style.cursor = "crosshair";
      });

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateDrawLayers(map: MapLibreMap, pts: [number, number][], isComplete: boolean) {
    // Update points layer
    const pointsSource = map.getSource("draw-points") as any;
    if (pointsSource) {
      pointsSource.setData({
        type: "FeatureCollection",
        features: pts.map((p) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: p },
          properties: {},
        })),
      });
    }

    if (isComplete && pts.length >= 3) {
      // Complete polygon
      const polyCoords = [...pts, pts[0]]; // Close the ring
      const polyFeature = {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [polyCoords],
        },
        properties: {},
      };
      const polySource = map.getSource("draw-poly") as any;
      if (polySource) {
        polySource.setData({ type: "FeatureCollection", features: [polyFeature] });
      }
      // Clear preview
      const previewSource = map.getSource("draw-preview") as any;
      if (previewSource) {
        previewSource.setData({ type: "FeatureCollection", features: [] });
      }
      // Emit
      const polygon: Polygon = { type: "Polygon", coordinates: [polyCoords] };
      onChange(polygon);
    } else if (pts.length >= 2) {
      // Preview polygon (not closed yet)
      const previewCoords = [...pts, pts[0]];
      const previewSource = map.getSource("draw-preview") as any;
      if (previewSource) {
        previewSource.setData({
          type: "FeatureCollection",
          features: [{
            type: "Feature" as const,
            geometry: { type: "Polygon" as const, coordinates: [previewCoords] },
            properties: {},
          }],
        });
      }
      // Clear completed poly
      const polySource = map.getSource("draw-poly") as any;
      if (polySource) {
        polySource.setData({ type: "FeatureCollection", features: [] });
      }
      onChange(null);
    } else {
      // Just points, no polygon yet
      const previewSource = map.getSource("draw-preview") as any;
      if (previewSource) {
        previewSource.setData({ type: "FeatureCollection", features: [] });
      }
      onChange(null);
    }
  }

  const startDrawing = useCallback(() => {
    setDrawing(true);
    drawingRef.current = true;
    pointsRef.current = [];
    setPoints([]);
    setHasGeom(false);
    onChange(null);
    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = "crosshair";
      // Clear all draw layers
      ["draw-poly", "draw-points", "draw-preview"].forEach((src) => {
        const s = map.getSource(src) as any;
        if (s) s.setData({ type: "FeatureCollection", features: [] });
      });
    }
  }, [onChange]);

  const finishDrawing = useCallback(() => {
    if (pointsRef.current.length < 3) return;
    const map = mapRef.current;
    if (map) {
      updateDrawLayers(map, pointsRef.current, true);
      map.getCanvas().style.cursor = "";
      // Zoom to polygon
      const polyCoords = [...pointsRef.current, pointsRef.current[0]];
      const b = computeBbox(polyCoords);
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 60, maxZoom: 16 });
    }
    setDrawing(false);
    drawingRef.current = false;
    setHasGeom(true);
  }, []);

  const undoPoint = useCallback(() => {
    if (pointsRef.current.length === 0) return;
    const newPts = pointsRef.current.slice(0, -1);
    pointsRef.current = newPts;
    setPoints([...newPts]);
    const map = mapRef.current;
    if (map) {
      updateDrawLayers(map, newPts, newPts.length >= 3);
    }
  }, []);

  const clearDraw = useCallback(() => {
    pointsRef.current = [];
    setPoints([]);
    setDrawing(false);
    drawingRef.current = false;
    setHasGeom(false);
    onChange(null);
    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = "";
      ["draw-poly", "draw-points", "draw-preview"].forEach((src) => {
        const s = map.getSource(src) as any;
        if (s) s.setData({ type: "FeatureCollection", features: [] });
      });
    }
  }, [onChange]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setShowResults(true);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", searchQuery);
      url.searchParams.set("format", "json");
      url.searchParams.set("countrycodes", "in");
      url.searchParams.set("limit", "5");
      const res = await fetch(url.toString(), { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      setSearchResults(
        (data.features ?? data ?? []).map((f: any) => ({
          label: f.display_name || f.label || f.name || searchQuery,
          coordinates: [f.lon ? parseFloat(f.lon) : f.center?.[0], f.lat ? parseFloat(f.lat) : f.center?.[1]] as [number, number],
        })).filter((r: any) => r.coordinates[0] && r.coordinates[1])
      );
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const flyToResult = useCallback((coords: [number, number], label: string) => {
    const map = mapRef.current as any;
    if (!map) return;
    map.flyTo({ center: coords, zoom: 14, duration: 1000 });
    setShowResults(false);

    // Remove old marker
    if (map.__currentMarker) {
      map.__currentMarker.remove();
    }

    const Marker = map.__Marker;
    const Popup = map.__Popup;
    if (Marker) {
      const el = document.createElement("div");
      el.innerHTML = `<div style="background:#f59e0b;color:white;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;white-space:nowrap">${label.split(",")[0]}</div>`;
      const marker = new Marker({ element: el, anchor: "bottom" })
        .setLngLat(coords)
        .setPopup(new Popup({ offset: 10 }).setText(label))
        .addTo(map);
      map.__currentMarker = marker;
    }
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <PenLine className="h-4 w-4 text-indigo-600" />
          Draw Boundary
        </div>
        {hasGeom && !drawing && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" />
              Polygon captured
            </span>
            <button
              type="button"
              onClick={clearDraw}
              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-0.5"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Geocoder search */}
      <div className="relative">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search location (e.g. Pune, Maharashtra)"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-200 disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0"
          >
            {searching ? <span className="animate-spin">⟳</span> : <MapPin className="h-3 w-3" />}
            Go
          </button>
        </div>

        {showResults && searchResults.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => flyToResult(r.coordinates, r.label)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 border-b last:border-0 transition-colors"
              >
                <div className="font-medium text-gray-800 truncate">{r.label.split(",")[0]}</div>
                <div className="text-[10px] text-gray-400 truncate">{r.label}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Drawing controls */}
      <div className="flex items-center gap-1.5">
        {!drawing ? (
          <button
            type="button"
            onClick={startDrawing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PenLine className="h-3.5 w-3.5" />
            Start Drawing
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={finishDrawing}
              disabled={points.length < 3}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Finish ({points.length} pts{points.length < 3 ? `, need ${3 - points.length} more` : ""})
            </button>
            <button
              type="button"
              onClick={undoPoint}
              disabled={points.length === 0}
              className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={clearDraw}
              className="flex items-center gap-1 px-2 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Cancel
            </button>
          </>
        )}
        {drawing && (
          <span className="text-[10px] text-amber-600 font-medium ml-1 animate-pulse">
            Click on map to place points
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="rounded-lg overflow-hidden border border-gray-200 relative"
        style={{ height }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-sm text-gray-400 animate-pulse">Loading map…</div>
          </div>
        )}
      </div>
    </div>
  );
}
