/**
 * GeoHarmonize — ParcelMap Component (Advanced GIS Engine)
 *
 * Full-featured MapLibre GL map with:
 * - Raster tile sources: OSM, Esri Satellite, OpenTopoMap (toggle)
 * - Nominatim India geocoder (countrycodes=in)
 * - Parcel polygon layer colored by risk_score
 * - Parcel labels showing ULPIN suffix + risk score
 * - Enhanced hover tooltips with rich project info
 * - Click → advanced parcel detail panel with risk gauge
 * - Project alignment GeoJSON overlay with 1km buffer zone
 * - Export map as PNG
 * - Measurement tools (distance/area)
 * - Draw mode for parcel boundaries
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as MapLibreMap, GeoJSONSource, LngLatBoundsLike } from "maplibre-gl";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { Layers, Satellite, Mountain, MapPin, X, Download, Ruler, Circle } from "lucide-react";

// Inline helpers — avoids @turf/turf dynamic import chunk errors
function computeBboxFromCoords(allCoords: [number, number][]): [number, number, number, number] | null {
  if (allCoords.length === 0) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of allCoords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

function extractCoords(geom: any): [number, number][] {
  if (!geom?.coordinates) return [];
  if (geom.type === "Point") return [geom.coordinates];
  if (geom.type === "LineString") return geom.coordinates;
  if (geom.type === "Polygon") return geom.coordinates[0];
  if (geom.type === "MultiPolygon") return geom.coordinates.flat(1).flat(1).reduce((acc: [number, number][], _: any, i: number, arr: any[]) => {
    if (i % 2 === 0) acc.push([arr[i], arr[i + 1]]);
    return acc;
  }, []);
  return [];
}

/** Approximate 1km buffer by expanding bbox by ~0.009° (~1km at equator) */
function simpleBuffer(geom: any, km: number): Polygon | null {
  const coords = extractCoords(geom);
  const bbox = computeBboxFromCoords(coords);
  if (!bbox) return null;
  const expand = km * 0.009; // ~0.009 degrees per km
  return {
    type: "Polygon",
    coordinates: [[
      [bbox[0] - expand, bbox[1] - expand],
      [bbox[2] + expand, bbox[1] - expand],
      [bbox[2] + expand, bbox[3] + expand],
      [bbox[0] - expand, bbox[3] + expand],
      [bbox[0] - expand, bbox[1] - expand],
    ]],
  };
}

export interface ParcelFeature {
  id: string;
  ulpin: string;
  project_id: string | null;
  survey_number: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  area_hectares: number | string | null;
  land_type: string | null;
  geometry_geojson: Polygon | MultiPolygon;
  ownership_status: "clear" | "disputed" | "under_verification";
  litigation_flag: boolean;
  risk_score: number | string;
}

export interface ProjectMapItem {
  id: string;
  name: string;
  district: string;
  state: string;
  land_requiring_body?: string;
  project_type?: string | null;
  current_stage: string;
  status_flag: "green" | "amber" | "red" | "lapsed";
  risk_score: number | string;
  alignment_geojson?: any;
}

interface ParcelMapProps {
  parcels?: ParcelFeature[];
  projectAlignment?: any;
  projects?: ProjectMapItem[];
  selectedProject?: ProjectMapItem | null;
  onProjectSelect?: (project: ProjectMapItem) => void;
  onParcelClick?: (parcel: ParcelFeature) => void;
  onAlignmentDraw?: (geojson: Polygon | MultiPolygon) => void;
  drawMode?: boolean;
  className?: string;
  initialBounds?: LngLatBoundsLike;
}

type RasterLayer = "osm" | "satellite" | "topo";

function getProjectCoordinates(geo: any): [number, number] | null {
  if (!geo) return null;
  if (geo.type === "Point" && Array.isArray(geo.coordinates)) return [geo.coordinates[0], geo.coordinates[1]];
  if (geo.type === "LineString" && geo.coordinates?.length > 0) {
    const mid = Math.floor(geo.coordinates.length / 2);
    return [geo.coordinates[mid][0], geo.coordinates[mid][1]];
  }
  if (geo.type === "Polygon" && geo.coordinates?.[0]?.length > 0) {
    const ring = geo.coordinates[0];
    let sLng = 0, sLat = 0;
    for (const c of ring) { sLng += c[0]; sLat += c[1]; }
    return [sLng / ring.length, sLat / ring.length];
  }
  if (geo.type === "MultiPolygon" && geo.coordinates?.[0]?.[0]?.length > 0) {
    const ring = geo.coordinates[0][0];
    let sLng = 0, sLat = 0;
    for (const c of ring) { sLng += c[0]; sLat += c[1]; }
    return [sLng / ring.length, sLat / ring.length];
  }
  return null;
}

function riskColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  return "#22c55e";
}

function riskLabel(score: number): string {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function statusColor(flag: string): string {
  return { green: "#22c55e", amber: "#f59e0b", red: "#ef4444", lapsed: "#7c3aed" }[flag] ?? "#6b7280";
}

function computeCentroid(geom: any): [number, number] | null {
  if (!geom?.coordinates) return null;
  const ring = geom.type === "Polygon" ? geom.coordinates[0] : geom.coordinates[0]?.[0];
  if (!ring?.length) return null;
  let sLng = 0, sLat = 0;
  for (const c of ring) { sLng += c[0]; sLat += c[1]; }
  return [sLng / ring.length, sLat / ring.length];
}

function buildParcelGeoJSON(parcels: ParcelFeature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: parcels.filter((p) => p.geometry_geojson).map((p) => {
      const score = Number(p.risk_score ?? 0);
      return {
        type: "Feature", id: p.id, geometry: p.geometry_geojson,
        properties: {
          id: p.id, ulpin: p.ulpin, survey_number: p.survey_number ?? "",
          village: p.village ?? "", district: p.district ?? "", state: p.state ?? "",
          area_hectares: Number(p.area_hectares ?? 0), land_type: p.land_type ?? "",
          ownership_status: p.ownership_status, litigation_flag: p.litigation_flag,
          risk_score: score, risk_label: riskLabel(score), fill_color: riskColor(score),
        },
      };
    }),
  };
}

function buildParcelLabels(parcels: ParcelFeature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: parcels.filter((p) => p.geometry_geojson).map((p) => {
      const centroid = computeCentroid(p.geometry_geojson);
      const score = Number(p.risk_score ?? 0);
      return {
        type: "Feature" as const,
        geometry: centroid ? { type: "Point" as const, coordinates: centroid } : { type: "Point" as const, coordinates: [0, 0] },
        properties: {
          id: p.id, ulpin: p.ulpin, risk_score: score,
          label_text: `${p.ulpin?.slice(-4) || "?"} · ${score.toFixed(0)}`,
        },
      };
    }).filter((f) => (f.geometry as any).coordinates[0] !== 0),
  };
}

const RASTER_SOURCES: Record<RasterLayer, { name: string; tiles: string[]; attribution: string; icon: React.ReactNode }> = {
  osm: { name: "Street", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>', icon: <MapPin className="h-3.5 w-3.5" /> },
  satellite: { name: "Satellite", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], attribution: "© Esri, DigitalGlobe", icon: <Satellite className="h-3.5 w-3.5" /> },
  topo: { name: "Topo", tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"], attribution: '© OpenTopoMap', icon: <Mountain className="h-3.5 w-3.5" /> },
};

export default function ParcelMap({
  parcels = [], projectAlignment = null, projects = [], selectedProject = null,
  onProjectSelect, onParcelClick, onAlignmentDraw, drawMode = false,
  className = "", initialBounds,
}: ParcelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<any[]>([]);
  const drawRef = useRef<unknown>(null);
  const [activeLayer, setActiveLayer] = useState<RasterLayer>("osm");
  const [selectedParcel, setSelectedParcel] = useState<ParcelFeature | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [drawActive, setDrawActive] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showBuffer, setShowBuffer] = useState(false);
  const [measureMode, setMeasureMode] = useState<"off" | "distance" | "area">("off");
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    Promise.all([import("maplibre-gl"), import("@maplibre/maplibre-gl-geocoder")]).then(([maplibre, { default: MaplibreGeocoder }]) => {
      const { Map, NavigationControl, ScaleControl, AttributionControl } = maplibre;
      const map = new Map({ container: containerRef.current!, style: buildStyle("osm"), center: [78.9629, 20.5937], zoom: 4.5, attributionControl: false });
      map.addControl(new NavigationControl(), "top-right");
      map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");
      map.addControl(new AttributionControl({ compact: true }), "bottom-left");

      const geocoderApi: any = {
        forwardGeocode: async (config: { query?: string | number[] }) => {
          const q = typeof config.query === "string" ? config.query : "";
          const url = new URL("https://nominatim.openstreetmap.org/search");
          url.searchParams.set("q", q); url.searchParams.set("format", "geojson");
          url.searchParams.set("countrycodes", "in"); url.searchParams.set("limit", "5");
          const res = await fetch(url.toString(), { headers: { "Accept-Language": "en" } });
          const data = await res.json();
          return { type: "FeatureCollection", features: (data.features ?? []).map((f: any) => ({ type: "Feature", geometry: { type: "Point", coordinates: f.geometry.coordinates }, place_name: f.properties.display_name, properties: f.properties, text: f.properties.display_name, place_type: ["place"], center: f.geometry.coordinates })) };
        },
        reverseGeocode: async () => ({ type: "FeatureCollection", features: [] }),
      };
      map.addControl(new MaplibreGeocoder(geocoderApi, { maplibregl: maplibre as any, placeholder: "Search district, tehsil, village…", collapsed: false }) as any, "top-left");

      map.on("load", () => {
        map.addSource("parcels", { type: "geojson", data: buildParcelGeoJSON([]) });
        map.addLayer({ id: "parcels-fill", type: "fill", source: "parcels", paint: { "fill-color": ["get", "fill_color"], "fill-opacity": 0.55 } });
        map.addLayer({ id: "parcels-stroke", type: "line", source: "parcels", paint: { "line-color": "#1e293b", "line-width": 1.2, "line-opacity": 0.8 } });
        map.addLayer({ id: "parcels-hover", type: "fill", source: "parcels", paint: { "fill-color": "#ffffff", "fill-opacity": 0.3 }, filter: ["==", ["get", "id"], ""] });

        map.addSource("parcel-labels", { type: "geojson", data: buildParcelLabels([]) });
        map.addLayer({ id: "parcel-labels-text", type: "symbol", source: "parcel-labels", layout: { "text-field": ["get", "label_text"], "text-size": 10, "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"], "text-allow-overlap": true, "text-ignore-placement": true }, paint: { "text-color": "#1e293b", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });

        map.addSource("alignment", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "alignment-buffer", type: "fill", source: "alignment", paint: { "fill-color": "#818cf8", "fill-opacity": 0.12 }, filter: ["in", "$type", "Polygon"] });
        map.addLayer({ id: "alignment-fill", type: "fill", source: "alignment", paint: { "fill-color": "#6366f1", "fill-opacity": 0.18 }, filter: ["in", "$type", "Polygon"] });
        map.addLayer({ id: "alignment-glow", type: "line", source: "alignment", paint: { "line-color": "#a5b4fc", "line-width": 6, "line-opacity": 0.45 } });
        map.addLayer({ id: "alignment-stroke", type: "line", source: "alignment", paint: { "line-color": "#4f46e5", "line-width": 3, "line-dasharray": [4, 2] } });

        map.addSource("measure", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "measure-line", type: "line", source: "measure", paint: { "line-color": "#f59e0b", "line-width": 2, "line-dasharray": [3, 2] } });
        map.addLayer({ id: "measure-points", type: "circle", source: "measure", paint: { "circle-radius": 5, "circle-color": "#f59e0b", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });

        setMapLoaded(true);
      });

      let hoveredId: string | null = null;
      map.on("mousemove", "parcels-fill", (e) => {
        if (e.features?.length) {
          const id = e.features[0].properties?.id as string;
          if (hoveredId !== id) { map.setFilter("parcels-hover", ["==", ["get", "id"], id]); hoveredId = id; }
          map.getCanvas().style.cursor = "pointer";
        }
      });
      map.on("mouseleave", "parcels-fill", () => { map.setFilter("parcels-hover", ["==", ["get", "id"], ""]); map.getCanvas().style.cursor = ""; hoveredId = null; });
      map.on("click", "parcels-fill", (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties as ParcelFeature;
        const match = parcels.find((p) => p.id === props.id);
        if (match) { setSelectedParcel(match); onParcelClick?.(match); }
      });
      mapRef.current = map;
    });
    return () => { mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildStyle(layer: RasterLayer) {
    const src = RASTER_SOURCES[layer];
    return { version: 8 as const, sources: { raster: { type: "raster" as const, tiles: src.tiles, tileSize: 256, attribution: src.attribution, maxzoom: 19 } }, layers: [{ id: "raster", type: "raster" as const, source: "raster" }] };
  }

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    (mapRef.current.getSource("parcels") as GeoJSONSource)?.setData(buildParcelGeoJSON(parcels));
    (mapRef.current.getSource("parcel-labels") as GeoJSONSource)?.setData(buildParcelLabels(parcels));
    if (mapRef.current.getLayer("parcel-labels-text")) {
      mapRef.current.setLayoutProperty("parcel-labels-text", "visibility", showLabels ? "visible" : "none");
    }
  }, [parcels, mapLoaded, showLabels]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const src = mapRef.current.getSource("alignment") as GeoJSONSource | undefined;
    if (projectAlignment) {
      const features: any[] = [{ type: "Feature", geometry: projectAlignment, properties: {} }];
      if (showBuffer) {
        try {
          const buffered = simpleBuffer(projectAlignment, 1);
          if (buffered) {
            const s = mapRef.current?.getSource("alignment") as GeoJSONSource | undefined;
            s?.setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: buffered, properties: { isBuffer: true } }, { type: "Feature", geometry: projectAlignment, properties: {} }] });
          }
        } catch (e) { console.error("Buffer error:", e); }
      }
      src?.setData({ type: "FeatureCollection", features });
    } else {
      src?.setData({ type: "FeatureCollection", features: [] });
    }
  }, [projectAlignment, mapLoaded, showBuffer]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!projects?.length) return;

    import("maplibre-gl").then((maplibre) => {
      projects.forEach((proj) => {
        const coords = getProjectCoordinates(proj.alignment_geojson);
        if (!coords) return;
        const isSelected = selectedProject?.id === proj.id;
        const risk = Number(proj.risk_score ?? 0);
        const color = statusColor(proj.status_flag);
        const shortLabel = proj.name.split(":")[0].replace(/Expansion|Widening|Extension/gi, "").trim() || proj.district;

        const el = document.createElement("div");
        el.className = "cursor-pointer select-none";
        el.style.zIndex = isSelected ? "50" : "20";
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer"><div style="display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:9999px;font-size:11px;font-weight:600;background:${isSelected?"#0f172a":"#fff"};color:${isSelected?"#f8fafc":"#1e293b"};border:1.5px solid ${isSelected?"#f59e0b":"#cbd5e1"};box-shadow:${isSelected?"0 10px 15px -3px rgba(0,0,0,.3),0 0 0 3px rgba(245,158,11,.45)":"0 3px 6px -1px rgba(0,0,0,.12)"};transform:${isSelected?"scale(1.1)":"scale(1)"};transition:all .2s"><span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;box-shadow:0 0 0 1.5px white"></span><span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${shortLabel}</span><span style="font-size:9px;opacity:.7;margin-left:2px">${risk.toFixed(0)}</span></div><div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid ${isSelected?"#f59e0b":"#94a3b8"};margin-top:-1px"></div></div>`;

        const popup = new maplibre.Popup({ offset: 14, closeButton: false, closeOnClick: false }).setHTML(`<div style="font-family:system-ui;padding:6px 8px;font-size:11px;max-width:240px"><div style="font-weight:700;color:#0f172a;margin-bottom:2px;line-height:1.2">${proj.name}</div><div style="color:#64748b;font-size:10px;margin-bottom:4px">${proj.land_requiring_body||""}</div><div style="color:#64748b;font-size:10px;margin-bottom:6px">📍 ${proj.district}, ${proj.state}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;border-top:1px solid #e2e8f0;padding-top:5px"><div style="background:#f1f5f9;border-radius:4px;padding:3px 6px;text-align:center"><div style="font-size:9px;color:#64748b;text-transform:uppercase">Status</div><div style="font-size:10px;font-weight:700;color:${color}">${proj.status_flag.toUpperCase()}</div></div><div style="background:#f1f5f9;border-radius:4px;padding:3px 6px;text-align:center"><div style="font-size:9px;color:#64748b;text-transform:uppercase">Risk</div><div style="font-size:10px;font-weight:700;color:${riskColor(risk)}">${risk.toFixed(1)}</div></div></div><div style="margin-top:5px;font-size:10px;color:#64748b"><span style="font-weight:600">Stage:</span> ${proj.current_stage.replace(/_/g," ")}</div><div style="margin-top:4px;font-size:10px;color:#d97706;font-weight:500">Click to view parcel details →</div></div>`);

        el.addEventListener("mouseenter", () => { if (!isSelected) popup.setLngLat(coords).addTo(map); });
        el.addEventListener("mouseleave", () => popup.remove());
        el.addEventListener("click", (e) => { e.stopPropagation(); popup.remove(); onProjectSelect?.(proj); });
        markersRef.current.push(new maplibre.Marker({ element: el, anchor: "bottom" }).setLngLat(coords).addTo(map));
      });
    });
  }, [projects, selectedProject, mapLoaded, onProjectSelect]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    if (selectedProject) {
      try {
        if (parcels.length > 0) {
          const valid = parcels.filter((p) => p.geometry_geojson);
          if (valid.length > 0) {
            const allCoords = valid.flatMap((p) => extractCoords(p.geometry_geojson));
            const b = computeBboxFromCoords(allCoords);
            if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 80, maxZoom: 15 });
            return;
          }
        }
        if (projectAlignment) {
          const allCoords = extractCoords(projectAlignment);
          const b = computeBboxFromCoords(allCoords);
          if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 80, maxZoom: 14 });
          return;
        }
        const coords = getProjectCoordinates(selectedProject.alignment_geojson);
        if (coords) map.flyTo({ center: coords, zoom: 12 });
      } catch (e) { console.error("Camera fit error:", e); }
    } else if (projects?.length > 0 && !initialBounds) {
      const allCoords = projects.map((p) => getProjectCoordinates(p.alignment_geojson)).filter((c): c is [number, number] => c !== null);
      if (allCoords.length > 1) {
        let [minLng, maxLng, minLat, maxLat] = [allCoords[0][0], allCoords[0][0], allCoords[0][1], allCoords[0][1]];
        allCoords.forEach(([lng, lat]) => { if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng; if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat; });
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, maxZoom: 7 });
      }
    }
  }, [selectedProject, projectAlignment, parcels, mapLoaded, projects, initialBounds]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    (mapRef.current.getSource("raster") as any)?.setTiles?.(RASTER_SOURCES[activeLayer].tiles);
  }, [activeLayer, mapLoaded]);

  const toggleDraw = useCallback(async () => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    if (!drawRef.current) {
      const { default: MapboxDraw } = await import("@mapbox/mapbox-gl-draw");
      const draw = new MapboxDraw({ displayControlsDefault: false, controls: { polygon: true, trash: true }, defaultMode: "draw_polygon" });
      map.addControl(draw as unknown as maplibregl.IControl);
      drawRef.current = draw;
      map.on("draw.create", () => { const d = draw.getAll(); const poly = d.features[0]?.geometry as Polygon | MultiPolygon | undefined; if (poly) onAlignmentDraw?.(poly); });
      map.on("draw.update", () => { const d = draw.getAll(); const poly = d.features[0]?.geometry as Polygon | MultiPolygon | undefined; if (poly) onAlignmentDraw?.(poly); });
      setDrawActive(true);
    } else { map.removeControl(drawRef.current as maplibregl.IControl); drawRef.current = null; setDrawActive(false); }
  }, [mapLoaded, onAlignmentDraw]);

  const handleExportPNG = useCallback(() => {
    if (!mapRef.current) return;
    const canvas = mapRef.current.getCanvas();
    const link = document.createElement("a");
     link.download = `geoharmonize-atlas-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || measureMode === "off") return;
    const map = mapRef.current;
    const handleClick = (e: { lngLat: { lng: number; lat: number } }) => {
      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setMeasurePoints((prev) => {
        const next = [...prev, point];
        const src = map.getSource("measure") as GeoJSONSource | undefined;
        if (src) {
          if (measureMode === "distance" && next.length >= 2) {
            src.setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: next }, properties: {} }] });
          } else if (measureMode === "area" && next.length >= 3) {
            src.setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[...next, next[0]]] }, properties: {} }] });
          } else {
            src.setData({ type: "FeatureCollection", features: next.map((p) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: p }, properties: {} })) });
          }
        }
        return next;
      });
    };
    map.on("click", handleClick);
    return () => { map.off("click", handleClick as any); };
  }, [mapLoaded, measureMode]);

  const clearMeasure = useCallback(() => {
    setMeasurePoints([]);
    (mapRef.current?.getSource("measure") as GeoJSONSource)?.setData({ type: "FeatureCollection", features: [] });
  }, []);

  const measureResult = (() => {
    if (measurePoints.length < 2) return null;
    if (measureMode === "distance") {
      let d = 0;
      for (let i = 1; i < measurePoints.length; i++) {
        const [lng1, lat1] = measurePoints[i - 1], [lng2, lat2] = measurePoints[i];
        const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        d += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      return `${d.toFixed(2)} km`;
    }
    if (measureMode === "area" && measurePoints.length >= 3) {
      const coords = [...measurePoints, measurePoints[0]];
      let a = 0;
      for (let i = 0; i < coords.length - 1; i++) a += coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1];
      return `${(Math.abs(a) / 2 * (Math.PI / 180) ** 2 * 6371 ** 2).toFixed(3)} km²`;
    }
    return null;
  })();

  return (
    <div className={`relative flex ${className}`}>
      <div ref={containerRef} className="flex-1 rounded-xl overflow-hidden" style={{ minHeight: 480 }} />

      <div className="absolute top-2 right-14 z-10 flex gap-1 bg-white/90 backdrop-blur rounded-lg shadow border p-1">
        {(Object.entries(RASTER_SOURCES) as [RasterLayer, typeof RASTER_SOURCES.osm][]).map(([key, src]) => (
          <button key={key} onClick={() => setActiveLayer(key)} title={src.name} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${activeLayer === key ? "bg-amber-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
            {src.icon} {src.name}
          </button>
        ))}
      </div>

      <div className="absolute top-12 right-14 z-10 flex gap-1">
        <button onClick={() => setShowLabels((v) => !v)} title="Toggle parcel labels" className={`p-1.5 rounded-lg text-xs font-medium shadow border transition-colors ${showLabels ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
          <span className="text-[10px] font-bold">ABC</span>
        </button>
        <button onClick={() => setShowBuffer((v) => !v)} title="Toggle 1km buffer zone" className={`p-1.5 rounded-lg text-xs font-medium shadow border transition-colors ${showBuffer ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
          <Circle className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setMeasureMode((v) => v === "off" ? "distance" : "off"); clearMeasure(); }} title="Measure distance/area" className={`p-1.5 rounded-lg text-xs font-medium shadow border transition-colors ${measureMode !== "off" ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
          <Ruler className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleExportPNG} title="Export map as PNG" className="p-1.5 rounded-lg text-xs font-medium shadow border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 transition-colors">
          <Download className="h-3.5 w-3.5" />
        </button>
        {drawMode && (
          <button onClick={toggleDraw} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium shadow border transition-colors ${drawActive ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"}`}>
            <Layers className="h-3.5 w-3.5" /> {drawActive ? "Drawing…" : "Draw"}
          </button>
        )}
      </div>

      {measureMode !== "off" && (
        <div className="absolute top-20 right-14 z-10 bg-amber-50 border border-amber-200 rounded-lg shadow px-3 py-2 text-xs">
          <div className="font-semibold text-amber-800 mb-1">{measureMode === "distance" ? "📏 Distance" : "📐 Area"} Measure</div>
          <div className="text-amber-700">
            {measurePoints.length === 0 && "Click on map to start"}
            {measurePoints.length === 1 && "Click another point"}
            {measureResult && <span className="font-bold ml-1">{measureResult}</span>}
          </div>
          {measurePoints.length > 0 && <button onClick={clearMeasure} className="mt-1 text-amber-600 hover:underline text-[10px]">Clear</button>}
        </div>
      )}

      <div className="absolute bottom-8 right-2 z-10 bg-white/90 backdrop-blur rounded-lg shadow border p-2.5 text-xs">
        <div className="font-semibold text-gray-700 mb-1.5">Risk Score</div>
        {[{ color: "#22c55e", label: "Low (0–40)" }, { color: "#f59e0b", label: "Medium (40–70)" }, { color: "#ef4444", label: "High (70+)" }].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 mb-0.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: item.color }} />
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
        <div className="border-t mt-1.5 pt-1.5 font-semibold text-gray-700 mb-1">Alignment</div>
        <div className="flex items-center gap-1.5 mb-0.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#6366f1", opacity: 0.6 }} /><span className="text-gray-600">Corridor</span></div>
        {showBuffer && <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#818cf8", opacity: 0.4 }} /><span className="text-gray-600">1km buffer</span></div>}
        <div className="border-t mt-1.5 pt-1.5 font-semibold text-gray-700 mb-1">Labels</div>
        <div className="text-gray-500 text-[10px]">Last 4 ULPIN · Risk score</div>
      </div>

      {selectedParcel && (
        <div className="absolute top-2 left-2 z-20 w-80 bg-white rounded-xl shadow-lg border p-4 animate-fade-in max-h-[calc(100%-80px)] overflow-y-auto">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">ULPIN (Bhu-Aadhaar)</div>
              <div className="font-mono font-bold text-sm text-amber-700">{selectedParcel.ulpin}</div>
            </div>
            <button onClick={() => setSelectedParcel(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg p-2"><div className="text-[10px] text-gray-400 mb-0.5">Survey No.</div><div className="font-medium text-gray-800">{selectedParcel.survey_number ?? "—"}</div></div>
              <div className="bg-gray-50 rounded-lg p-2"><div className="text-[10px] text-gray-400 mb-0.5">Area</div><div className="font-medium text-gray-800">{selectedParcel.area_hectares ? `${selectedParcel.area_hectares} ha` : "—"}</div></div>
            </div>
            <Row label="Village" value={selectedParcel.village ?? "—"} />
            <Row label="District" value={selectedParcel.district ?? "—"} />
            <Row label="State" value={selectedParcel.state ?? "—"} />
            <Row label="Land Type" value={selectedParcel.land_type ?? "—"} />
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Ownership</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selectedParcel.ownership_status === "clear" ? "bg-green-100 text-green-700" : selectedParcel.ownership_status === "disputed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{selectedParcel.ownership_status.replace(/_/g, " ")}</span>
            </div>
            {selectedParcel.litigation_flag && (
              <div className="flex items-center gap-1.5 text-red-600 text-xs bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                <span className="text-base">⚠️</span>
                <div><div className="font-semibold">Active Litigation</div><div className="text-[10px] text-red-500">Court stay order may apply</div></div>
              </div>
            )}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 border mt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 font-semibold text-xs">Risk Assessment</span>
                <a href="/risk" className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">Full Analysis →</a>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                    <circle cx="28" cy="28" r="24" stroke={riskColor(Number(selectedParcel.risk_score ?? 0))} strokeWidth="4" fill="none" strokeDasharray={`${(Number(selectedParcel.risk_score ?? 0) / 100) * 150.8} 150.8`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center"><span className="text-sm font-black" style={{ color: riskColor(Number(selectedParcel.risk_score ?? 0)) }}>{Number(selectedParcel.risk_score ?? 0).toFixed(0)}</span></div>
                </div>
                <div>
                  <div className="text-lg font-black" style={{ color: riskColor(Number(selectedParcel.risk_score ?? 0)) }}>{Number(selectedParcel.risk_score ?? 0).toFixed(1)} / 100</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: riskColor(Number(selectedParcel.risk_score ?? 0)) }}>{riskLabel(Number(selectedParcel.risk_score ?? 0))} RISK</div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <a href={`/workflow/${selectedParcel.project_id || ""}`} className="flex-1 text-center text-[10px] font-semibold px-2 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">View Workflow</a>
              <a href="/risk" className="flex-1 text-center text-[10px] font-semibold px-2 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors">Risk Factors</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (<div className="flex justify-between"><span className="text-gray-500">{label}</span><span className="text-gray-800 font-medium">{value}</span></div>);
}
