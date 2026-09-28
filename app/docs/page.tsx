import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — GeoSync",
  description:
    "Architecture, confidence scoring and REST API reference for the GeoSync platform.",
};

export default function DocsPage() {
  return (
    <div className="w-full h-[calc(100vh-57px)] bg-slate-50">
      <iframe
        src="/docs.html"
        className="w-full h-full border-0"
        title="GeoSync Platform Documentation"
      />
    </div>
  );
}
