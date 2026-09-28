"use client";

/**
 * GeoSync — HarmonizeReviewMap Component
 * Interactive Web-GIS map built with MapLibre GL JS.
 * Renders:
 * - Base layers: OSM Streets & Esri World Imagery (Satellite)
 * - Harmonized Parcels layer with status coloring (approved=green, unverified=amber)
 * - Conflicting Geometry A (Drone / Candidate: Cyan/Blue outline)
 * - Conflicting Geometry B (Cadastral / Baseline: Saffron/Orange outline)
 * - Spatial Conflict Delta (Geometry Diff: Crimson/Red fill)
 * - Dynamic flyTo bounding box when a conflict is selected
 */

import React, { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import { Layers, Satellite, ZoomIn, ZoomOut, Maximize2, AlertTriangle } from "lucide-react";

export interface GeoConflict {
  conflict_id: string;
  parcel_uid_a: string;
  parcel_uid_b: string;
  conflict_type: string;
  difference_value: number;
  confidence_score: number;
  score_reasons: Array<{
    factor: string;
    weight: number;
    raw_value: number;
    contribution: number;
    explanation: string;
  }>;
  recommended_action: string;
  status: string;
  survey_a?: string;
  survey_b?: string;
  owner_a?: string;
  owner_b?: string;
  geometry_a?: any;
  geometry_b?: any;
  geometry_diff?: any;
}

export interface HarmonizedParcel {
  parcel_uid: string;
  ulpin?: string;
  survey_number?: string;
  owner_name?: string;
  geometry_area_sqm?: number;
  validation_status: string;
  version: number;
  geometry?: any;
}

interface HarmonizeReviewMapProps {
  conflicts?: GeoConflict[];
  selectedConflict?: GeoConflict | null;
  parcels?: HarmonizedParcel[];
  selectedParcel?: HarmonizedParcel | null;
  onSelectConflict?: (conflict: GeoConflict) => void;
  onSelectParcel?: (parcel: HarmonizedParcel) => void;
  className?: string;
}

export default function HarmonizeReviewMap({
  conflicts = [],
  selectedConflict = null,
  parcels = [],
  selectedParcel = null,
  onSelectConflict,
  onSelectParcel,
  className = "",
}: HarmonizeReviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [baseLayer, setBaseLayer] = useState<"streets" | "satellite">("streets");
  const [showConflicts, setShowConflicts] = useState(true);
  const [showParcels, setShowParcels] = useState(true);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    parcels: true,
    conflicts: true,
    cadastral: true,
    drone: true,
    buildings: false,
    gnss: false,
  });

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let isMounted = true;

    async function initMap() {
      const maplibregl = (await import("maplibre-gl")).default;

      // Pune default coordinates [lng, lat]
      const defaultCenter: [number, number] = [73.8567, 18.5204];

      const styleObj: any = {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
          esri: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "© Esri World Imagery",
          },
        },
        layers: [
          {
            id: "osm-layer",
            type: "raster",
            source: "osm",
            layout: { visibility: "visible" },
          },
          {
            id: "esri-layer",
            type: "raster",
            source: "esri",
            layout: { visibility: "none" },
          },
        ],
      };

      const map = new maplibregl.Map({
        container: mapContainerRef.current!,
        style: styleObj,
        center: defaultCenter,
        zoom: 14,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

      map.on("load", () => {
        if (!isMounted) return;
        mapRef.current = map;
        setMapLoaded(true);

        // Add empty GeoJSON sources
        // 1. All Parcels Source
        map.addSource("parcels-source", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "parcels-fill",
          type: "fill",
          source: "parcels-source",
          paint: {
            "fill-color": [
              "match",
              ["get", "validation_status"],
              "auto_linked",
              "#10b981", // emerald
              "human_approved",
              "#059669", // dark emerald
              "rejected",
              "#ef4444", // red
              "#f59e0b", // amber/default
            ],
            "fill-opacity": 0.25,
          },
        });

        map.addLayer({
          id: "parcels-line",
          type: "line",
          source: "parcels-source",
          paint: {
            "line-color": [
              "match",
              ["get", "validation_status"],
              "auto_linked",
              "#059669",
              "human_approved",
              "#047857",
              "#d97706",
            ],
            "line-width": 1.5,
          },
        });

        // 2. Selected Conflict: Baseline Geometry B (Cadastral / Saffron)
        map.addSource("conflict-geom-b", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "conflict-geom-b-fill",
          type: "fill",
          source: "conflict-geom-b",
          paint: {
            "fill-color": "#ea580c", // Saffron / Orange
            "fill-opacity": 0.35,
          },
        });
        map.addLayer({
          id: "conflict-geom-b-line",
          type: "line",
          source: "conflict-geom-b",
          paint: {
            "line-color": "#c2410c",
            "line-width": 2.5,
            "line-dasharray": [2, 1],
          },
        });

        // 3. Selected Conflict: Candidate Geometry A (Drone / Cyan)
        map.addSource("conflict-geom-a", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "conflict-geom-a-fill",
          type: "fill",
          source: "conflict-geom-a",
          paint: {
            "fill-color": "#0284c7", // Sky blue
            "fill-opacity": 0.35,
          },
        });
        map.addLayer({
          id: "conflict-geom-a-line",
          type: "line",
          source: "conflict-geom-a",
          paint: {
            "line-color": "#0369a1",
            "line-width": 2.5,
          },
        });

        // 4. Selected Conflict: Geometry Difference (Crimson Red Delta)
        map.addSource("conflict-geom-diff", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "conflict-geom-diff-fill",
          type: "fill",
          source: "conflict-geom-diff",
          paint: {
            "fill-color": "#ef4444", // Red
            "fill-opacity": 0.6,
          },
        });
        map.addLayer({
          id: "conflict-geom-diff-line",
          type: "line",
          source: "conflict-geom-diff",
          paint: {
            "line-color": "#b91c1c",
            "line-width": 2,
          },
        });
      });
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update base layer visibility
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    if (map.getLayer("osm-layer") && map.getLayer("esri-layer")) {
      map.setLayoutProperty("osm-layer", "visibility", baseLayer === "streets" ? "visible" : "none");
      map.setLayoutProperty("esri-layer", "visibility", baseLayer === "satellite" ? "visible" : "none");
    }
  }, [baseLayer, mapLoaded]);

  // Update parcels GeoJSON data
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const source = mapRef.current.getSource("parcels-source") as GeoJSONSource | undefined;
    if (!source) return;

    const features = parcels
      .filter((p) => p.geometry)
      .map((p) => ({
        type: "Feature" as const,
        id: p.parcel_uid,
        properties: {
          parcel_uid: p.parcel_uid,
          survey_number: p.survey_number || "N/A",
          owner_name: p.owner_name || "N/A",
          validation_status: p.validation_status,
          version: p.version,
        },
        geometry: p.geometry,
      }));

    source.setData({
      type: "FeatureCollection",
      features,
    });
  }, [parcels, mapLoaded]);

  // Update selected conflict geometries & flyTo
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    const srcA = map.getSource("conflict-geom-a") as GeoJSONSource | undefined;
    const srcB = map.getSource("conflict-geom-b") as GeoJSONSource | undefined;
    const srcDiff = map.getSource("conflict-geom-diff") as GeoJSONSource | undefined;

    if (!srcA || !srcB || !srcDiff) return;

    if (!selectedConflict) {
      srcA.setData({ type: "FeatureCollection", features: [] });
      srcB.setData({ type: "FeatureCollection", features: [] });
      srcDiff.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const featA = selectedConflict.geometry_a
      ? [{ type: "Feature" as const, properties: { label: "Candidate A" }, geometry: selectedConflict.geometry_a }]
      : [];
    const featB = selectedConflict.geometry_b
      ? [{ type: "Feature" as const, properties: { label: "Baseline B" }, geometry: selectedConflict.geometry_b }]
      : [];
    const featDiff = selectedConflict.geometry_diff
      ? [{ type: "Feature" as const, properties: { label: "Delta Diff" }, geometry: selectedConflict.geometry_diff }]
      : [];

    srcA.setData({ type: "FeatureCollection", features: featA });
    srcB.setData({ type: "FeatureCollection", features: featB });
    srcDiff.setData({ type: "FeatureCollection", features: featDiff });

    // Compute bounding box to zoom into
    const coords: [number, number][] = [];
    const collectCoords = (geom: any) => {
      if (!geom) return;
      if (geom.type === "Polygon" && geom.coordinates?.[0]) {
        coords.push(...geom.coordinates[0]);
      } else if (geom.type === "MultiPolygon" && geom.coordinates) {
        geom.coordinates.forEach((poly: any) => {
          if (poly[0]) coords.push(...poly[0]);
        });
      }
    };

    collectCoords(selectedConflict.geometry_a);
    collectCoords(selectedConflict.geometry_b);
    collectCoords(selectedConflict.geometry_diff);

    if (coords.length > 0) {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
        padding: 80,
        maxZoom: 18,
        duration: 1200,
      });
    }
  }, [selectedConflict, mapLoaded]);

  return (
    <div className={`relative w-full h-full min-h-[500px] overflow-hidden rounded-lg border border-slate-200 shadow-sm ${className}`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Basemap Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm p-1.5 rounded-md border border-slate-200 shadow-sm text-xs font-medium text-slate-700">
          <button
            onClick={() => setBaseLayer("streets")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
              baseLayer === "streets"
                ? "bg-brand-600 text-white shadow-xs font-semibold"
                : "hover:bg-slate-100 text-slate-600"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Streets
          </button>
          <button
            onClick={() => setBaseLayer("satellite")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
              baseLayer === "satellite"
                ? "bg-brand-600 text-white shadow-xs font-semibold"
                : "hover:bg-slate-100 text-slate-600"
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            Satellite
          </button>
        </div>

        {/* Layer Toggle Checkboxes */}
        <div className="bg-white/95 backdrop-blur-sm p-2.5 rounded-md border border-slate-200 shadow-sm text-xs space-y-1.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data Layers</div>
          {[
            { key: "parcels", label: "Harmonized Parcels", color: "bg-emerald-500" },
            { key: "conflicts", label: "Conflicts", color: "bg-red-500" },
            { key: "cadastral", label: "Cadastral Baseline", color: "bg-[#ea580c]" },
            { key: "drone", label: "Drone Survey", color: "bg-sky-500" },
            { key: "buildings", label: "Building Footprints", color: "bg-violet-500" },
            { key: "gnss", label: "GNSS Points", color: "bg-amber-500" },
          ].map((layer) => (
            <label key={layer.key} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg px-1.5 py-1 transition-colors">
              <input
                type="checkbox"
                checked={layerVisibility[layer.key as keyof typeof layerVisibility] ?? true}
                onChange={(e) => setLayerVisibility((prev) => ({ ...prev, [layer.key]: e.target.checked }))}
                className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className={`w-2.5 h-2.5 rounded-sm ${layer.color}`} />
              <span className="text-slate-700 font-medium">{layer.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Legend Badge Overlay */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-950/85 text-white backdrop-blur-md p-3 rounded-md border border-slate-800 shadow-lg text-[11px] max-w-xs">
        <div className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Map Spatial Layers
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-[#ea580c]/80 border border-[#c2410c]" />
            <span className="text-slate-300">Baseline Cadastral Boundary (B)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-sky-500/80 border border-sky-400" />
            <span className="text-slate-300">Candidate Drone Survey (A)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-red-500/90 border border-red-400" />
            <span className="text-red-200 font-medium">Discrepancy / Drift Delta</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
            <span className="w-3 h-3 rounded-xs bg-emerald-500/60 border border-emerald-400" />
            <span className="text-slate-300">Verified / Harmonized Parcels</span>
          </div>
        </div>
      </div>
    </div>
  );
}
