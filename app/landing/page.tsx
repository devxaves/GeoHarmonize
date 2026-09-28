"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MapPin,
  Upload,
  AlertTriangle,
  BarChart3,
  Archive,
  Search,
  ArrowRight,
  CheckCircle2,
  Shield,
  Layers,
  GitBranch,
  Compass,
  Sparkles,
  FileSearch,
  Database,
  Zap,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react";

const pipelineStages = [
  {
    id: 1,
    icon: Upload,
    title: "Ingest",
    desc: "Multi-source upload: drone ORI, cadastral maps, revenue records, GNSS points",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    id: 2,
    icon: Compass,
    title: "CRS Normalize",
    desc: "Auto-detect & transform to EPSG:4326 — always logged, never silent",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    id: 3,
    icon: GitBranch,
    title: "Topology Fix",
    desc: "ST_MakeValid repair, sliver detection, gap and overlap analysis",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    id: 4,
    icon: Layers,
    title: "Match",
    desc: "Spatial matching via bounding-box + ST_DWithin, then IoU scoring",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    id: 5,
    icon: Sparkles,
    title: "Score",
    desc: "5-factor confidence: IoU 35%, RapidFuzz 20%, ID 15%, Reliability 15%, Recency 15%",
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    id: 6,
    icon: Eye,
    title: "Human Review",
    desc: "Conflict queue with dual-geometry map, explainable score breakdown",
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
  {
    id: 7,
    icon: CheckCircle,
    title: "Publish",
    desc: "Append-only versioning, GeoJSON/GeoPackage export, audit trail",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
];

const modules = [
  {
    category: "WEB-GIS ATLAS",
    title: "Spatial Conflict Review",
    desc: "Map-first review workspace with dual-geometry visualization, 5-factor explainable scoring, and human approve/reject workflow.",
    href: "/atlas",
    icon: MapPin,
    accent: "text-orange-600",
    bg: "bg-orange-50",
    badge: "MapLibre GL + PostGIS",
  },
  {
    category: "DATA INGESTION",
    title: "Multi-Source Upload",
    desc: "Drone ORI, cadastral GeoJSON, scanned revenue records, GNSS survey points — with CRS detection and topology validation.",
    href: "/upload",
    icon: Upload,
    accent: "text-blue-600",
    bg: "bg-blue-50",
    badge: "FastAPI + GeoPandas",
  },
  {
    category: "EXECUTIVE ANALYTICS",
    title: "Operations Dashboard",
    desc: "Real-time KPIs: parcels processed, auto-resolution rate, manual effort reduction, confidence tier distribution.",
    href: "/dashboard",
    icon: BarChart3,
    accent: "text-amber-600",
    bg: "bg-amber-50",
    badge: "Recharts + Framer Motion",
  },
  {
    category: "AUDIT & EXPORT",
    title: "Digital Archive",
    desc: "Immutable audit trail, parcel version history, conflict log, and GeoJSON/GeoPackage export for inter-departmental exchange.",
    href: "/archive",
    icon: Archive,
    accent: "text-emerald-600",
    bg: "bg-emerald-50",
    badge: "Append-Only",
  },
  {
    category: "CHANGE DETECTION",
    title: "Temporal Comparison",
    desc: "Two-vintage comparison flagging boundary shifts, subdivisions, new buildings, and demolitions — all labeled verification required.",
    href: "/atlas",
    icon: TrendingUp,
    accent: "text-violet-600",
    bg: "bg-violet-50",
    badge: "Hausdorff + IoU",
  },
  {
    category: "ADMIN CONSOLE",
    title: "System Administration",
    desc: "Dataset registry, user/role management, pipeline run history, and confidence threshold configuration.",
    href: "/admin",
    icon: Shield,
    accent: "text-slate-600",
    bg: "bg-slate-100",
    badge: "RBAC",
  },
];

const stats = [
  { value: "200+", label: "Parcels per Ward", sub: "Multi-Source Harmonized" },
  { value: "5-Factor", label: "Confidence Scoring", sub: "Fully Explainable" },
  { value: "100%", label: "Audit Trail", sub: "Append-Only Versioning" },
  { value: "7-Stage", label: "Pipeline", sub: "Ingest to Publish" },
];

export default function LandingPage() {
  const [activeStage, setActiveStage] = useState(0);

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-900">
      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative border-b border-slate-200 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50/60 via-white to-amber-50/40" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Left: Text + Search */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-orange-200 bg-orange-50/90 text-orange-800 text-xs font-semibold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span>SIH 26013 · Department of Land Resources · GoI</span>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                  AI-Assisted Geospatial
                  <br />
                  <span className="text-orange-600">Land Record</span>{" "}
                  <span className="text-amber-600">Integration</span>
                </h1>
                <p className="text-base text-slate-500 leading-relaxed max-w-xl">
                  Ingest multi-source land data — drone imagery, cadastral maps, revenue records, GNSS points —
                  and produce a single, confidence-scored, harmonized parcel database. Every decision explainable,
                  reversible, and routed to a human reviewer when uncertain.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/atlas"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-sm transition-transform active:scale-95"
                >
                  <MapPin className="w-4 h-4" />
                  Open Review Atlas
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
                >
                  <Upload className="w-4 h-4 text-orange-600" />
                  Ingest Data
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
                >
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                  Dashboard
                </Link>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-4 border-t border-slate-200/60">
                {[
                  "5-Factor Explainable Scoring",
                  "Append-Only Versioning",
                  "GeoJSON / GeoPackage Export",
                  "Human-in-the-Loop Review",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Pipeline Visual */}
            <div className="relative rounded-2xl bg-slate-950 overflow-hidden shadow-2xl border border-slate-700/80 p-6 lg:p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    Harmonization Pipeline
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE
                  </span>
                </div>

                <div className="space-y-2">
                  {pipelineStages.map((stage, idx) => {
                    const Icon = stage.icon;
                    const isActive = idx === activeStage;
                    const isPassed = idx < activeStage;
                    return (
                      <motion.button
                        key={stage.id}
                        onClick={() => setActiveStage(idx)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${
                          isActive
                            ? "bg-orange-500/10 border-orange-500/40 shadow-lg"
                            : isPassed
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]"
                        }`}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive
                              ? "bg-orange-500 text-white"
                              : isPassed
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/[0.06] text-slate-400"
                          }`}
                        >
                          {isPassed ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-xs font-bold ${
                              isActive ? "text-orange-300" : isPassed ? "text-emerald-300" : "text-slate-300"
                            }`}
                          >
                            Stage {stage.id}: {stage.title}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{stage.desc}</div>
                        </div>
                        <div
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            isActive
                              ? "bg-orange-500/20 text-orange-300"
                              : isPassed
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-white/[0.06] text-slate-500"
                          }`}
                        >
                          {String(stage.id).padStart(2, "0")}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Pipeline Progress</span>
                    <span className="text-orange-400 font-bold">
                      Stage {activeStage + 1} of {pipelineStages.length}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                      animate={{ width: `${((activeStage + 1) / pipelineStages.length) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden border-y border-slate-800 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-orange-400/40 hover:bg-white/[0.06] transition-all text-center"
              >
                <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-orange-400 font-mono tracking-tight">
                  {s.value}
                </div>
                <div className="text-xs sm:text-sm text-slate-200 font-semibold mt-1.5">{s.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{s.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULE GRID ─────────────────────────────────────────────── */}
      <section className="py-16 border-b border-slate-200/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-9 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">
                Platform Architecture
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Core Platform Modules
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                End-to-end geospatial data harmonization — from multi-source ingestion to confidence-scored publish.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3.5 py-2 rounded-xl transition-colors self-start md:self-auto"
            >
              <span>Executive KPI View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <motion.div
                  key={mod.href + i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={mod.href}
                    className="group flex flex-col justify-between p-6 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all h-full"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold font-mono tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase border border-slate-200">
                          {mod.category}
                        </span>
                        <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200/60">
                          {mod.badge}
                        </span>
                      </div>
                      <div className="flex items-start gap-3.5 mb-3">
                        <div
                          className={`p-3 rounded-xl ${mod.bg} flex-shrink-0 group-hover:scale-110 transition-transform`}
                        >
                          <Icon className={`w-5 h-5 ${mod.accent}`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base group-hover:text-orange-700 transition-colors">
                            {mod.title}
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{mod.desc}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-orange-600 group-hover:text-orange-700">
                      <span>Launch Module</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CONFIDENCE SCORING FORMULA ──────────────────────────────── */}
      <section className="py-16 bg-gradient-to-b from-orange-50/20 via-white to-amber-50/20 border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100/70 border border-orange-200 text-orange-800 text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>EXPLAINABLE AI</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              5-Factor Confidence Scoring
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Every automated match is scored with a transparent, weighted formula. No black boxes.
              The full breakdown is stored and rendered for every conflict.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { factor: "Geometry Overlap", weight: "35%", desc: "IoU between candidate geometries", color: "bg-blue-500" },
              { factor: "Attribute Match", weight: "20%", desc: "RapidFuzz on owner names", color: "bg-emerald-500" },
              { factor: "Identifier Match", weight: "15%", desc: "Survey number / property ID", color: "bg-violet-500" },
              { factor: "Source Reliability", weight: "15%", desc: "Static weight per source type", color: "bg-amber-500" },
              { factor: "Temporal Recency", weight: "15%", desc: "Newer data scores higher", color: "bg-rose-500" },
            ].map((f, i) => (
              <motion.div
                key={f.factor}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl border border-slate-200 p-5 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-3 h-3 rounded-full ${f.color} mx-auto mb-3`} />
                <div className="text-2xl font-black text-slate-900 font-mono">{f.weight}</div>
                <div className="text-xs font-bold text-slate-800 mt-1">{f.factor}</div>
                <div className="text-[10px] text-slate-500 mt-1">{f.desc}</div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold text-emerald-800">Score &gt;= 90% → Auto-Linked</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="font-semibold text-amber-800">60-89% → Human Review</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs">
              <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="font-semibold text-rose-800">&lt;60% → Unresolved</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROLE ACCESS CARDS ────────────────────────────────────────── */}
      <section className="py-16 bg-slate-50/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-10">
            <div className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">Access Control</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Role-Based Portals
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl mx-auto">
              Purpose-built interfaces for every stakeholder in the land record integration workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                title: "Land Records Reviewer",
                badge: "Review Queue Access",
                desc: "Inspect spatial conflicts on the map, review the 5-factor score breakdown, and approve or reject matches with full audit logging.",
                href: "/atlas",
                cta: "Open Review Atlas",
                icon: MapPin,
                color: "border-orange-200 bg-orange-50/40 hover:border-orange-300",
                iconColor: "text-orange-700 bg-orange-100",
                ctaColor: "bg-orange-600 hover:bg-orange-700",
              },
              {
                title: "System Administrator",
                badge: "Full Admin Console",
                desc: "Manage datasets, users, roles, pipeline runs, and confidence thresholds. Monitor system health and audit trail.",
                href: "/admin",
                cta: "Admin Console",
                icon: Shield,
                color: "border-slate-200 bg-slate-50/50 hover:border-slate-300",
                iconColor: "text-slate-600 bg-slate-100",
                ctaColor: "bg-slate-800 hover:bg-slate-900",
              },
              {
                title: "Data Analyst",
                badge: "Analytics & Export",
                desc: "Explore harmonized parcel data, track pipeline KPIs, perform temporal change detection, and export to GeoJSON/GeoPackage.",
                href: "/dashboard",
                cta: "View Dashboard",
                icon: BarChart3,
                color: "border-amber-200 bg-amber-50/50 hover:border-amber-300",
                iconColor: "text-amber-600 bg-amber-100",
                ctaColor: "bg-amber-700 hover:bg-amber-800",
              },
            ].map((role) => {
              const Icon = role.icon;
              return (
                <div
                  key={role.href}
                  className={`p-6 rounded-2xl border ${role.color} flex flex-col gap-4 transition-all`}
                >
                  <div className={`w-10 h-10 rounded-xl ${role.iconColor} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500">
                      {role.badge}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{role.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">{role.desc}</p>
                  </div>
                  <Link
                    href={role.href}
                    className={`mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg ${role.ctaColor} text-white text-xs font-semibold transition-colors shadow-sm w-fit`}
                  >
                    {role.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ──────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white py-16 overflow-hidden border-t border-slate-800">
        <div className="absolute -left-20 -top-20 w-72 h-72 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="absolute -right-20 -bottom-20 w-72 h-72 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-mono mb-3">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>PostGIS + MapLibre GL + FastAPI</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-1.5">
              Ready to harmonize your land records?
            </h2>
            <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
              Upload multi-source geospatial data, let the AI match and score conflicts,
              review on the map, and publish a single harmonized parcel database.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 flex-shrink-0">
            <Link
              href="/atlas"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-lg shadow-orange-500/20 transition-transform active:scale-95"
            >
              <MapPin className="w-4 h-4" />
              <span>Open Review Atlas</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-colors shadow-sm"
            >
              <Shield className="w-4 h-4 text-orange-400" />
              <span>Official Login</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
