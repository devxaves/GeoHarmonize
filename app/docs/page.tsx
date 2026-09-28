import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — GeoHarmonize Platform Architecture & Geospatial Integration Engine",
  description:
    "Official technical documentation, API specifications, PostGIS spatial database schema, and confidence scoring pipeline guide for GeoHarmonize platform.",
};

export default function DocsPage() {
  return (
    <div className="w-full h-[calc(100vh-57px)] bg-slate-950">
      <iframe
        src="/docs.html"
        className="w-full h-full border-0"
        title="GeoHarmonize Platform Documentation"
      />
    </div>
  );
}
