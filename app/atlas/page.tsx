"use client";

/**
 * GeoSync — Web-GIS Harmonization & Spatial Conflict Review (/atlas)
 *
 * Implements PRD §6.6, §6.10, §9 (Phase 3 & Phase 5):
 * - Map view rendering candidate & baseline geometries with conflict delta
 * - Conflict queue list filterable by status & score
 * - Detail panel rendering the 5-factor explainable score breakdown (never bare numbers)
 * - Human reviewer actions: Approve Match, Reject Match, Field Verification Required
 * - All actions write to gh_audit_log with before_state / after_state (PRD §12)
 * - GeoJSON and GeoPackage export shortcuts
 */

import React, { useState, useEffect, useCallback, useTransition } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  FileSearch,
  Download,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  MapPin,
  Check,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import ConflictDetailPanel from "@/components/conflicts/ConflictDetailPanel";
import type { GeoConflict, HarmonizedParcel } from "@/components/map/HarmonizeReviewMap";

// Dynamic load map to prevent SSR issues
const HarmonizeReviewMap = dynamic(
  () => import("@/components/map/HarmonizeReviewMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-2" />
        <div className="text-sm font-semibold text-slate-700">Loading map…</div>
              </div>
    ),
  }
);

export default function AtlasReviewPage() {
  const [activeTab, setActiveTab] = useState<"conflicts" | "changes">("conflicts");
  const [conflicts, setConflicts] = useState<GeoConflict[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [parcels, setParcels] = useState<HarmonizedParcel[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<GeoConflict | null>(null);
  const [selectedChange, setSelectedChange] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fetch conflicts, changes, and parcels
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [confResp, changResp, parcResp] = await Promise.all([
        fetch("/api/conflicts?limit=100"),
        fetch("/api/changes?limit=100"),
        fetch("/api/parcels?limit=200"),
      ]);

      if (confResp.ok) {
        const confData = await confResp.json();
        const confList: GeoConflict[] = confData.conflicts || [];
        setConflicts(confList);
        if (confList.length > 0 && !selectedConflict) {
          setSelectedConflict(confList[0]);
        }
      }

      if (changResp.ok) {
        const changData = await changResp.json();
        const changeList = changData.changes || [];
        setChanges(changeList);
        if (changeList.length > 0 && !selectedChange) {
          setSelectedChange(changeList[0]);
        }
      }

      if (parcResp.ok) {
        const parcData = await parcResp.json();
        setParcels(parcData.parcels || []);
      }
    } catch (err) {
      console.error("Failed to load map data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedConflict, selectedChange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle reviewer decision
  const handleDecision = async (
    action: "approve_match" | "reject_match" | "field_verification_required",
    notes: string
  ) => {
    if (!selectedConflict) return;
    setIsSubmitting(true);

    try {
      const resp = await fetch(`/api/conflicts/${selectedConflict.conflict_id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Decision recording failed");
      }

      const res = await resp.json();

      // Show toast notification
      const actionLabels = {
        approve_match: "Conflict Approved & Parcel Versioned",
        reject_match: "Conflict Rejected",
        field_verification_required: "Field Verification Requested",
      };
      setNotification({
        message: `${actionLabels[action]} (Logged to Audit Trail)`,
        type: "success",
      });
      setTimeout(() => setNotification(null), 4000);

      // Refresh data
      await loadData();
    } catch (err: any) {
      alert(`Error recording decision: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered conflicts
  const filteredConflicts = conflicts.filter((c) => {
    // Status filter
    if (filterStatus === "open" && c.status !== "open") return false;
    if (filterStatus === "approved" && c.status !== "approved") return false;
    if (filterStatus === "human_review" && c.recommended_action !== "human_review") return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSurvey =
        (c.survey_a && c.survey_a.toLowerCase().includes(q)) ||
        (c.survey_b && c.survey_b.toLowerCase().includes(q));
      const matchOwner =
        (c.owner_a && c.owner_a.toLowerCase().includes(q)) ||
        (c.owner_b && c.owner_b.toLowerCase().includes(q));
      const matchId = c.conflict_id.toLowerCase().includes(q);
      const matchType = c.conflict_type.toLowerCase().includes(q);
      return matchSurvey || matchOwner || matchId || matchType;
    }

    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-slate-100 overflow-hidden font-sans">
      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 text-white shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              Review Atlas
            </h1>
            <p className="text-xs text-slate-500">
              Compare survey geometries, review confidence scores and resolve conflicts
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1">
          <button
            onClick={() => setActiveTab("conflicts")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "conflicts"
                ? "bg-white text-brand-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 inline mr-1" />
            Conflicts ({conflicts.length})
          </button>
          <button
            onClick={() => setActiveTab("changes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "changes"
                ? "bg-white text-brand-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
            Changes ({changes.length})
          </button>
        </div>

        {/* Action Controls & Export Buttons */}
        <div className="flex items-center gap-2">
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold shadow-xs"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              {notification.message}
            </motion.div>
          )}

          <button
            onClick={() => loadData()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-brand-600" : ""}`} />
            Refresh
          </button>

          {/* Export Dropdown */}
          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <a
              href="/api/export/geojson"
              download="geosync_parcels.geojson"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export GeoJSON
            </a>
            <a
              href="/api/export/geopackage"
              download="geosync_parcels.gpkg"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              GeoPackage
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Workspace: 3 Columns (Queue, Map, Detail Panel) ───────────── */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* ── Column 1: Conflict Queue Sidebar ─────────────────────────────── */}
        <aside className="w-80 lg:w-96 flex flex-col bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
          {/* Header & Tabs */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50/60">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                {activeTab === "conflicts" ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-brand-600" />
                    Conflict Queue
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-violet-600" />
                    Change Events
                  </>
                )}
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-800 border border-brand-200 font-mono">
                {activeTab === "conflicts"
                  ? `${filteredConflicts.length} of ${conflicts.length}`
                  : `${changes.length} events`}
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center p-0.5 rounded-md bg-slate-200/80 text-xs font-medium text-slate-600 mb-2.5">
              <button
                onClick={() => setFilterStatus("all")}
                className={`flex-1 py-1 rounded-lg text-center transition-all ${
                  filterStatus === "all" ? "bg-white text-slate-900 font-bold shadow-2xs" : "hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus("open")}
                className={`flex-1 py-1 rounded-lg text-center transition-all ${
                  filterStatus === "open" ? "bg-white text-slate-900 font-bold shadow-2xs" : "hover:text-slate-900"
                }`}
              >
                Open
              </button>
              <button
                onClick={() => setFilterStatus("human_review")}
                className={`flex-1 py-1 rounded-lg text-center transition-all ${
                  filterStatus === "human_review" ? "bg-white text-slate-900 font-bold shadow-2xs" : "hover:text-slate-900"
                }`}
              >
                Review
              </button>
              <button
                onClick={() => setFilterStatus("approved")}
                className={`flex-1 py-1 rounded-lg text-center transition-all ${
                  filterStatus === "approved" ? "bg-white text-slate-900 font-bold shadow-2xs" : "hover:text-slate-900"
                }`}
              >
                Approved
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search survey #, owner, or ID…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Conflict/Changes List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600 mb-2" />
                <span className="text-xs">Fetching data…</span>
              </div>
            ) : activeTab === "changes" ? (
              changes.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  <div className="text-sm font-semibold text-slate-700">No change events detected</div>
                  <div className="text-xs text-slate-400 mt-1">Run change detection between two dataset vintages</div>
                </div>
              ) : (
                changes.map((e: any) => {
                  const isSelected = selectedChange?.id === e.id;
                  return (
                    <motion.div
                      key={e.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedChange(e)}
                      className={`p-3 rounded-md border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-violet-50/80 border-violet-500 shadow-xs"
                          : "bg-white hover:bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[11px] font-bold text-slate-900 capitalize truncate">
                          {e.change_type?.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-800">
                          {(e.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Parcel:</span>
                          <span className="font-semibold text-slate-800 font-mono">{e.parcel_uid}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] truncate">
                          <span className="text-slate-400">Description:</span>
                          <span className="text-slate-700 truncate max-w-[170px]">{e.description}</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                          Verification Required
                        </span>
                        <span className="text-slate-400">
                          {new Date(e.created_at).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )
            ) : filteredConflicts.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <div className="text-sm font-semibold text-slate-700">No conflicts in queue</div>
                <div className="text-xs text-slate-400 mt-1">All matches meet the auto-link threshold or are approved.</div>
              </div>
            ) : (
              filteredConflicts.map((c) => {
                const isSelected = selectedConflict?.conflict_id === c.conflict_id;
                const scorePct = Math.round(c.confidence_score * 100);

                return (
                  <motion.div
                    key={c.conflict_id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedConflict(c)}
                    className={`p-3 rounded-md border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-brand-50/80 border-brand-500 shadow-xs"
                        : "bg-white hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[11px] font-bold text-slate-900 capitalize truncate">
                        {c.conflict_type.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                          c.confidence_score >= 0.9
                            ? "bg-emerald-100 text-emerald-800"
                            : c.confidence_score >= 0.6
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {scorePct}% score
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Survey A / B:</span>
                        <span className="font-semibold text-slate-800 font-mono">
                          {c.survey_a || "N/A"} ↔ {c.survey_b || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] truncate">
                        <span className="text-slate-400">Owners:</span>
                        <span className="text-slate-700 truncate max-w-[170px]">
                          {c.owner_a || c.owner_b || "Unknown"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="capitalize">{c.recommended_action?.replace(/_/g, " ")}</span>
                      <span className="uppercase font-semibold tracking-wider text-slate-500">{c.status}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Column 2: Web-GIS Interactive Map ────────────────────────────── */}
        <main className="flex-1 flex flex-col rounded-lg overflow-hidden relative">
          <HarmonizeReviewMap
            conflicts={conflicts}
            selectedConflict={selectedConflict}
            parcels={parcels}
            onSelectConflict={setSelectedConflict}
          />
        </main>

        {/* ── Column 3: Detail Panel ───────────────────────────────────────── */}
        <AnimatePresence>
          {activeTab === "changes" && selectedChange && (
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="w-80 lg:w-[420px] flex-shrink-0 h-full"
            >
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/60">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 capitalize">
                      {selectedChange.change_type?.replace(/_/g, " ")}
                    </h3>
                    <button
                      onClick={() => setSelectedChange(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Parcel UID</div>
                    <div className="text-xs font-mono text-slate-800">{selectedChange.parcel_uid}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Confidence</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full"
                          style={{ width: `${(selectedChange.confidence || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {((selectedChange.confidence || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description</div>
                    <p className="text-xs text-slate-600 leading-relaxed">{selectedChange.description}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Area Delta</div>
                    <div className="text-xs font-mono text-slate-800">
                      {selectedChange.area_delta_sqm ? `${selectedChange.area_delta_sqm} sqm` : "N/A"}
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Verification Required
                    </div>
                    <p className="text-[11px] text-amber-700 mt-1">
                      This change event requires field verification before any action is taken.
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
          {activeTab === "conflicts" && selectedConflict && (
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="w-80 lg:w-[420px] flex-shrink-0 h-full"
            >
              <ConflictDetailPanel
                conflict={selectedConflict}
                onDecision={handleDecision}
                onClose={() => setSelectedConflict(null)}
                isSubmitting={isSubmitting}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
