"use client";

/**
 * GeoSync — ConflictDetailPanel Component
 * Review panel displaying:
 * - Side-by-side attributes comparison (Survey #, Owner, Area, Source System)
 * - Difference value (boundary drift in meters, area difference in sqm)
 * - Explainable 5-Factor Confidence Score breakdown (PRD §5) with progress meters & explanations
 * - Human reviewer actions: Approve Match, Reject Match, Request Field Verification
 * - Reviewer notes input
 * - Reversibility & Audit Log note (PRD §1, §6.6)
 */

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  FileSearch,
  Scale,
  ShieldAlert,
  Clock,
  ArrowRight,
  Info,
  Loader2,
  MapPin,
  User,
  Hash,
  SquareDashedBottom,
  Send,
} from "lucide-react";
import type { GeoConflict } from "@/components/map/HarmonizeReviewMap";

interface ConflictDetailPanelProps {
  conflict: GeoConflict;
  onDecision: (action: "approve_match" | "reject_match" | "field_verification_required", notes: string) => Promise<void>;
  onClose?: () => void;
  isSubmitting?: boolean;
}

export default function ConflictDetailPanel({
  conflict,
  onDecision,
  onClose,
  isSubmitting = false,
}: ConflictDetailPanelProps) {
  const [notes, setNotes] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleAction = async (action: "approve_match" | "reject_match" | "field_verification_required") => {
    setActiveAction(action);
    try {
      await onDecision(action, notes);
      setNotes("");
    } finally {
      setActiveAction(null);
    }
  };

  const scorePct = Math.round(conflict.confidence_score * 100);

  // Status color badge
  const scoreBadge =
    conflict.confidence_score >= 0.9
      ? { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Auto-Link Candidate (≥90%)" }
      : conflict.confidence_score >= 0.6
      ? { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "Human Review Required (60–89%)" }
      : { bg: "bg-rose-50 text-rose-700 border-rose-200", label: "Low Confidence (<60%)" };

  const factorIcons: Record<string, any> = {
    geometry_overlap: SquareDashedBottom,
    attribute_similarity: User,
    identifier_match: Hash,
    source_reliability: Scale,
    temporal_recency: Clock,
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800 border border-brand-200">
              <ShieldAlert className="w-3 h-3 text-brand-600" />
              {conflict.conflict_type.replace(/_/g, " ").toUpperCase()}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${scoreBadge.bg}`}>
              {scoreBadge.label}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Conflict #{conflict.conflict_id.slice(0, 8)}
          </h2>
          {conflict.difference_value > 0 && (
            <span className="text-xs font-medium text-slate-500">
              Discrepancy: <strong className="text-slate-800">{conflict.difference_value}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Side-by-side Parcel Attributes */}
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            Feature Comparison
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Candidate A (Drone Survey) */}
            <div className="p-3 rounded-md border border-sky-200 bg-sky-50/40">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800 mb-2">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                Candidate Layer (A)
              </div>
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-slate-500">Survey #: </span>
                  <span className="font-semibold text-slate-800 font-mono">{conflict.survey_a || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Owner: </span>
                  <span className="font-semibold text-slate-800">{conflict.owner_a || "N/A"}</span>
                </div>
                <div className="truncate">
                  <span className="text-slate-500">UID: </span>
                  <span className="text-slate-600 font-mono text-[10px]">{conflict.parcel_uid_a.slice(0, 18)}…</span>
                </div>
              </div>
            </div>

            {/* Baseline B (Cadastral) */}
            <div className="p-3 rounded-md border border-brand-200 bg-brand-50/40">
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand-800 mb-2">
                <span className="w-2 h-2 rounded-full bg-brand-500" />
                Baseline Cadastre (B)
              </div>
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-slate-500">Survey #: </span>
                  <span className="font-semibold text-slate-800 font-mono">{conflict.survey_b || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Owner: </span>
                  <span className="font-semibold text-slate-800">{conflict.owner_b || "N/A"}</span>
                </div>
                <div className="truncate">
                  <span className="text-slate-500">UID: </span>
                  <span className="text-slate-600 font-mono text-[10px]">{conflict.parcel_uid_b.slice(0, 18)}…</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Confidence Score & 5-Factor Breakdown (PRD §5) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Explainable Confidence Score
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-slate-900 font-mono">{conflict.confidence_score.toFixed(3)}</span>
              <span className="text-xs text-slate-400"> / 1.0</span>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4 border border-slate-200/80">
            <div
              className={`h-full transition-all duration-500 ${
                conflict.confidence_score >= 0.9
                  ? "bg-emerald-500"
                  : conflict.confidence_score >= 0.6
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${Math.max(4, scorePct)}%` }}
            />
          </div>

          {/* Factor Breakdown Cards */}
          <div className="space-y-2.5">
            {conflict.score_reasons && conflict.score_reasons.length > 0 ? (
              conflict.score_reasons.map((reason, idx) => {
                const IconComponent = factorIcons[reason.factor] || Scale;
                const factorPercent = Math.round(reason.raw_value * 100);
                const weightPercent = Math.round(reason.weight * 100);

                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-md border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700 capitalize">
                        <IconComponent className="w-3.5 h-3.5 text-brand-600" />
                        {reason.factor.replace(/_/g, " ")}
                        <span className="text-[10px] text-slate-400 font-normal">
                          (wt {weightPercent}%)
                        </span>
                      </div>
                      <div className="font-mono text-slate-800 font-medium">
                        raw: {(reason.raw_value * 100).toFixed(0)}% · +{(reason.contribution * 100).toFixed(1)}%
                      </div>
                    </div>

                    {/* Micro bar */}
                    <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden mb-1.5">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(2, factorPercent)}%` }}
                      />
                    </div>

                    <div className="text-[11px] text-slate-600 leading-snug">
                      {reason.explanation}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 italic">No factor breakdown available.</div>
            )}
          </div>
        </div>

        {/* Reviewer Notes Field */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Reviewer Notes / Justification
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add legal or survey justification (recorded permanently in audit trail)…"
            rows={2}
            className="w-full text-xs p-2.5 rounded-md border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-slate-400 text-slate-800"
          />
        </div>

        {/* Status / History */}
        <div className="p-3 bg-amber-50/50 rounded-md border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Reversible:</strong> Every decision creates an append-only versioned record and is logged in the permanent audit trail. No records are ever permanently deleted.
          </div>
        </div>
      </div>

      {/* Decision Actions Bar */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleAction("approve_match")}
            disabled={isSubmitting || conflict.status !== "open"}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {activeAction === "approve_match" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Approve
          </button>

          <button
            onClick={() => handleAction("reject_match")}
            disabled={isSubmitting || conflict.status !== "open"}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md border border-rose-300 hover:bg-rose-50 text-rose-700 disabled:opacity-50 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {activeAction === "reject_match" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            Reject
          </button>

          <button
            onClick={() => handleAction("field_verification_required")}
            disabled={isSubmitting || conflict.status !== "open"}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 text-xs font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {activeAction === "field_verification_required" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSearch className="w-3.5 h-3.5" />
            )}
            Field Verify
          </button>
        </div>
        {conflict.status !== "open" && (
          <div className="mt-2 text-center text-[11px] font-medium text-slate-500">
            This conflict has been marked as <span className="font-bold text-slate-700">{conflict.status}</span>.
          </div>
        )}
      </div>
    </div>
  );
}
