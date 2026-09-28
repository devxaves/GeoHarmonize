"use client";

import React from "react";
import Link from "next/link";
import {
  MapPin,
  Upload,
  BarChart3,
  Archive,
  ArrowRight,
  CheckCircle2,
  Shield,
  Layers,
  GitBranch,
  Compass,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Scale,
  FileCheck2,
  Lock,
  Languages,
} from "lucide-react";

const pipelineStages = [
  { icon: Upload, title: "Ingest", desc: "Drone ORI, cadastral maps, revenue records and GNSS points in their native formats." },
  { icon: Compass, title: "Normalise CRS", desc: "Source projections detected and transformed to EPSG:4326. Every transform is logged." },
  { icon: GitBranch, title: "Repair topology", desc: "Invalid geometries repaired; slivers, gaps and overlaps flagged for review." },
  { icon: Layers, title: "Match", desc: "Candidate parcels paired by spatial proximity, then compared by overlap (IoU)." },
  { icon: Scale, title: "Score", desc: "Each match gets a weighted five-factor confidence score with a stored breakdown." },
  { icon: Eye, title: "Review", desc: "Uncertain matches go to a reviewer with both geometries shown side by side." },
  { icon: CheckCircle, title: "Publish", desc: "Approved parcels are versioned, never overwritten, and exportable as GeoJSON or GeoPackage." },
];

const modules = [
  {
    title: "Review Atlas",
    desc: "Map-first workspace to inspect conflicting boundaries, read the score breakdown and approve or reject each match.",
    href: "/atlas",
    icon: MapPin,
    tone: "text-brand-700 bg-brand-50",
  },
  {
    title: "Data Ingestion",
    desc: "Upload cadastral GeoJSON, drone survey layers, GNSS points and scanned revenue records with automatic CRS detection.",
    href: "/upload",
    icon: Upload,
    tone: "text-emerald-700 bg-emerald-50",
  },
  {
    title: "Operations Dashboard",
    desc: "Parcels processed, auto-resolution rate, review backlog and confidence distribution across the district.",
    href: "/dashboard",
    icon: BarChart3,
    tone: "text-violet-700 bg-violet-50",
  },
  {
    title: "Audit Archive",
    desc: "Append-only audit log, parcel version history and exports for inter-departmental data exchange.",
    href: "/archive",
    icon: Archive,
    tone: "text-crimson-700 bg-crimson-50",
  },
  {
    title: "Change Detection",
    desc: "Compare two survey vintages to flag boundary shifts, subdivisions and new construction for field verification.",
    href: "/atlas",
    icon: TrendingUp,
    tone: "text-amber-800 bg-amber-50",
  },
  {
    title: "Administration",
    desc: "Manage datasets, users and roles, pipeline runs and the confidence thresholds used for auto-linking.",
    href: "/admin",
    icon: Shield,
    tone: "text-slate-700 bg-slate-100",
  },
];

const scoringFactors = [
  { factor: "Geometry overlap", weight: 35, desc: "Intersection-over-union of the two boundaries", color: "bg-brand-600" },
  { factor: "Owner name match", weight: 20, desc: "Fuzzy comparison of recorded owner names", color: "bg-emerald-600" },
  { factor: "Identifier match", weight: 15, desc: "Survey number or property ID agreement", color: "bg-violet-600" },
  { factor: "Source reliability", weight: 15, desc: "Fixed weight per source type", color: "bg-amber-500" },
  { factor: "Recency", weight: 15, desc: "More recent surveys score higher", color: "bg-crimson-500" },
];

const principles = [
  { icon: FileCheck2, title: "Explainable", desc: "Every automated decision stores the factors that produced it." },
  { icon: Lock, title: "Append-only", desc: "Records are versioned, never deleted. Every change is attributable." },
  { icon: Eye, title: "Human-reviewed", desc: "Anything below the auto-link threshold waits for a reviewer." },
  { icon: Languages, title: "Accessible", desc: "Built to WCAG 2.1 AA with English and Hindi interfaces." },
];

export default function LandingPage() {
  return (
    <div className="bg-white text-slate-900">
      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="space-y-6">
              <p className="text-sm font-semibold text-brand-700">Land record integration platform</p>

              <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-bold tracking-tight text-slate-900 leading-[1.15]">
                One reliable parcel record from every survey source
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                GeoSync brings drone imagery, cadastral maps, revenue records and GNSS surveys into a single
                parcel database. Matches are scored transparently, uncertain cases go to a reviewer, and every
                change is kept on record.
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/atlas"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
                >
                  Open Review Atlas
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  Upload survey data
                </Link>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-5 border-t border-slate-200">
                {[
                  "Five-factor explainable scoring",
                  "Append-only version history",
                  "GeoJSON and GeoPackage export",
                  "Reviewer sign-off on uncertain matches",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Product visual: survey imagery with parcel overlay */}
            <figure className="relative rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white text-xs">
                <span className="font-semibold text-slate-700">Ward 12 · Drone ORI vs. cadastral</span>
                <span className="text-slate-500 font-mono">EPSG:4326</span>
              </div>
              <div className="relative aspect-[16/10]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/roadImage.png"
                  alt="Aerial drone image of a road corridor with land parcel boundaries overlaid"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <svg viewBox="0 0 400 250" className="absolute inset-0 w-full h-full" aria-hidden="true">
                  {/* Cadastral baseline (dashed) */}
                  <g fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9">
                    <path d="M205 95 L290 78 L318 128 L228 150 Z" />
                    <path d="M228 150 L318 128 L340 185 L250 205 Z" />
                  </g>
                  {/* Surveyed geometry */}
                  <path d="M210 98 L292 83 L322 131 L232 152 Z" fill="rgb(3 139 230 / 0.28)" stroke="#038BE6" strokeWidth="2" />
                  <path d="M232 152 L322 131 L348 190 L262 214 Z" fill="rgb(227 55 95 / 0.25)" stroke="#E3375F" strokeWidth="2" />
                  <path d="M60 150 L130 135 L150 185 L78 200 Z" fill="rgb(16 185 129 / 0.25)" stroke="#10B981" strokeWidth="2" />
                </svg>

                <div className="absolute left-3 bottom-3 right-3 sm:right-auto sm:w-64 rounded-md bg-white/95 border border-slate-200 shadow-sm p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Survey No. 214/3</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">Review</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: "74%" }} />
                    </div>
                    <span className="font-mono font-semibold text-slate-700">74%</span>
                  </div>
                  <p className="mt-1.5 text-slate-500">Boundary shifted 3.8 m against 1998 cadastral map</p>
                </div>
              </div>
              <figcaption className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 border-t border-slate-200 text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-brand-500" /> Auto-linked</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-crimson-500" /> Conflict</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500" /> New parcel</span>
                <span className="flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-slate-500" /> Cadastral baseline</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ── KEY FACTS ───────────────────────────────────────────────── */}
      <section className="border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 lg:gap-x-0 lg:divide-x divide-slate-200">
            {[
              { value: "7", label: "Pipeline stages", sub: "From ingest to publish" },
              { value: "5", label: "Scoring factors", sub: "Each stored and explainable" },
              { value: "≥ 90%", label: "Auto-link threshold", sub: "Configurable by administrators" },
              { value: "100%", label: "Changes audited", sub: "Append-only history" },
            ].map((s) => (
              <div key={s.label} className="py-7 lg:px-6 lg:first:pl-0">
                <dt className="text-sm font-medium text-slate-600">{s.label}</dt>
                <dd className="mt-1 text-3xl font-bold text-slate-900 tracking-tight">{s.value}</dd>
                <dd className="mt-0.5 text-xs text-slate-500">{s.sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── MODULES ─────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">What GeoSync does</h2>
            <p className="text-base text-slate-600 mt-2">
              Six modules cover the full workflow, from raw survey files to a published, auditable parcel record.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.title}
                  href={mod.href}
                  className="group flex flex-col p-5 rounded-lg bg-white border border-slate-200 hover:border-brand-300 hover:shadow-sm transition-all"
                >
                  <div className={`w-10 h-10 rounded-md ${mod.tone} flex items-center justify-center mb-4`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base group-hover:text-brand-700">{mod.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mt-1.5 flex-1">{mod.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                    Open
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PIPELINE ────────────────────────────────────────────────── */}
      <section className="py-14 lg:py-16 bg-slate-50 border-y border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">How records are processed</h2>
            <p className="text-base text-slate-600 mt-2">
              Every dataset follows the same seven steps. Nothing is published without passing through each one.
            </p>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {pipelineStages.map((stage, idx) => {
              const Icon = stage.icon;
              return (
                <li key={stage.title} className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <Icon className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">{stage.title}</h3>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{stage.desc}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── CONFIDENCE SCORING ──────────────────────────────────────── */}
      <section className="py-14 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">How confidence is scored</h2>
            <p className="text-base text-slate-600 mt-2 leading-relaxed">
              Each candidate match is scored with a fixed, published formula. The full breakdown is stored
              with the record and shown to the reviewer.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              <li className="flex items-center gap-2.5 p-3 rounded-md bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span className="text-emerald-900"><strong>90% and above</strong> — linked automatically (reversible)</span>
              </li>
              <li className="flex items-center gap-2.5 p-3 rounded-md bg-amber-50 border border-amber-200">
                <Clock className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span className="text-amber-900"><strong>60–89%</strong> — sent to a reviewer</span>
              </li>
              <li className="flex items-center gap-2.5 p-3 rounded-md bg-red-50 border border-red-200">
                <XCircle className="w-4 h-4 text-red-700 flex-shrink-0" />
                <span className="text-red-900"><strong>Below 60%</strong> — left unresolved for field verification</span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3 rounded-lg border border-slate-200 divide-y divide-slate-200">
            {scoringFactors.map((f) => (
              <div key={f.factor} className="p-4 sm:px-5 grid grid-cols-[1fr_auto] sm:grid-cols-[12rem_1fr_3rem] items-center gap-x-4 gap-y-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{f.factor}</div>
                  <div className="text-xs text-slate-500">{f.desc}</div>
                </div>
                <div className="hidden sm:block h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full ${f.color}`} style={{ width: `${(f.weight / 35) * 100}%` }} />
                </div>
                <div className="text-right text-sm font-mono font-semibold text-slate-900">{f.weight}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRINCIPLES ──────────────────────────────────────────────── */}
      <section className="py-14 bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Built for public records</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {principles.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title}>
                  <Icon className="w-6 h-6 text-brand-600" />
                  <h3 className="mt-3 text-base font-semibold text-slate-900">{p.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-brand-800 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Start with your existing survey data</h2>
            <p className="text-sm text-brand-100 mt-1.5 max-w-xl leading-relaxed">
              Upload a cadastral layer and a recent survey. GeoSync will match, score and queue conflicts for review.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 flex-shrink-0">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-white hover:bg-brand-50 text-brand-800 text-sm font-semibold transition-colors"
            >
              Upload data
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/atlas"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-brand-400 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
            >
              Open Review Atlas
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
