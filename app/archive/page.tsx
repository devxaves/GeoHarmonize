"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import {
  Search,
  Download,
  Archive,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  AlertTriangle,
  TrendingUp,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Tab = "parcels" | "conflicts" | "changes";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "parcels", label: "Parcels", icon: <Database className="h-4 w-4" /> },
  { id: "conflicts", label: "Conflicts", icon: <AlertTriangle className="h-4 w-4" /> },
  { id: "changes", label: "Change Events", icon: <TrendingUp className="h-4 w-4" /> },
];

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState<Tab>("parcels");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 15;

  const parcelsUrl = `/api/parcels?limit=${limit}&offset=${(page - 1) * limit}${
    statusFilter !== "all" ? `&status=${statusFilter}` : ""
  }`;
  const conflictsUrl = `/api/conflicts?limit=${limit}&offset=${(page - 1) * limit}${
    statusFilter !== "all" ? `&status=${statusFilter}` : ""
  }`;
  const changesUrl = `/api/changes?limit=${limit}&offset=${(page - 1) * limit}`;

  const { data: parcelsData, isValidating: parcelsLoading } = useSWR<{ total: number; parcels: any[] }>(
    activeTab === "parcels" ? parcelsUrl : null,
    fetcher
  );
  const { data: conflictsData, isValidating: conflictsLoading } = useSWR<{ total: number; conflicts: any[] }>(
    activeTab === "conflicts" ? conflictsUrl : null,
    fetcher
  );
  const { data: changesData, isValidating: changesLoading } = useSWR<{ total: number; changes: any[] }>(
    activeTab === "changes" ? changesUrl : null,
    fetcher
  );

  const isLoading = parcelsLoading || conflictsLoading || changesLoading;

  const total = activeTab === "parcels" ? parcelsData?.total || 0 : activeTab === "conflicts" ? conflictsData?.total || 0 : changesData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const csvExportUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("format", "csv");
    return `/api/export/geojson?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center text-brand-700">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-brand-700">Audit Archive</span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
                  Append-Only · Immutable
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
                Harmonized Data Archive
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Unified lookup across parcels, spatial conflicts, and change detection events.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <a
              href={csvExportUrl()}
              download
              className="flex items-center gap-2 px-5 py-2.5 rounded-md text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 shadow-md transition-all cursor-pointer font-mono uppercase tracking-wider"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-100/90 rounded-lg w-fit border border-slate-200/60">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-5 relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by UID, survey number, owner, or ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-8 py-2.5 text-xs rounded-md border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="sm:col-span-3 inline-flex rounded-md border border-slate-200 bg-slate-100/80 p-1 text-xs">
              {["all", "open", "approved", "rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-semibold capitalize text-center transition-all ${
                    statusFilter === s
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          {activeTab === "parcels" && (
            <ParcelsTable data={parcelsData?.parcels || []} isLoading={isLoading} />
          )}
          {activeTab === "conflicts" && (
            <ConflictsTable data={conflictsData?.conflicts || []} isLoading={isLoading} />
          )}
          {activeTab === "changes" && (
            <ChangesTable data={changesData?.changes || []} isLoading={isLoading} />
          )}

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> · {total} records
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ParcelsTable({ data, isLoading }: { data: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
        <span className="text-xs">Loading parcels...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400">
        <Database className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <div className="text-sm font-semibold text-slate-500">No parcels found</div>
        <div className="text-xs text-slate-400 mt-1">Upload and harmonize a dataset to populate the archive</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-100 uppercase font-mono font-semibold text-[10px]">
          <tr>
            <th className="p-3.5">Parcel UID</th>
            <th className="p-3.5">Source</th>
            <th className="p-3.5">Survey No.</th>
            <th className="p-3.5">Owner</th>
            <th className="p-3.5">Area (sqm)</th>
            <th className="p-3.5">Status</th>
            <th className="p-3.5">Version</th>
            <th className="p-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((p) => (
            <tr key={p.parcel_uid} className="hover:bg-brand-50/20 transition-colors">
              <td className="p-3.5 font-mono text-[11px] text-slate-700">{p.parcel_uid}</td>
              <td className="p-3.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  {p.source_system || "unknown"}
                </span>
              </td>
              <td className="p-3.5 font-mono text-[11px]">{p.survey_number || "N/A"}</td>
              <td className="p-3.5 text-slate-700">{p.owner_name || "Unknown"}</td>
              <td className="p-3.5 font-mono text-[11px]">{p.geometry_area_sqm?.toFixed(0) || "N/A"}</td>
              <td className="p-3.5">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    p.validation_status === "auto_linked"
                      ? "bg-emerald-100 text-emerald-800"
                      : p.validation_status === "human_approved"
                      ? "bg-blue-100 text-blue-800"
                      : p.validation_status === "rejected"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {p.validation_status || "unverified"}
                </span>
              </td>
              <td className="p-3.5 font-mono text-[11px]">v{p.version || 1}</td>
              <td className="p-3.5 text-right">
                <a
                  href={`/atlas?parcel=${p.parcel_uid}`}
                  className="text-brand-600 hover:text-brand-700 font-semibold text-[11px]"
                >
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConflictsTable({ data, isLoading }: { data: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
        <span className="text-xs">Loading conflicts...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-300" />
        <div className="text-sm font-semibold text-slate-500">No conflicts found</div>
        <div className="text-xs text-slate-400 mt-1">All matches meet the auto-link threshold or are resolved</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-100 uppercase font-mono font-semibold text-[10px]">
          <tr>
            <th className="p-3.5">Conflict ID</th>
            <th className="p-3.5">Type</th>
            <th className="p-3.5">Parcel A</th>
            <th className="p-3.5">Parcel B</th>
            <th className="p-3.5">Score</th>
            <th className="p-3.5">Recommended</th>
            <th className="p-3.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((c) => (
            <tr key={c.conflict_id} className="hover:bg-brand-50/20 transition-colors">
              <td className="p-3.5 font-mono text-[11px] text-slate-700">{c.conflict_id.slice(0, 8)}...</td>
              <td className="p-3.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                  {c.conflict_type?.replace(/_/g, " ") || "unknown"}
                </span>
              </td>
              <td className="p-3.5 font-mono text-[11px]">{c.parcel_uid_a?.slice(0, 12)}...</td>
              <td className="p-3.5 font-mono text-[11px]">{c.parcel_uid_b?.slice(0, 12)}...</td>
              <td className="p-3.5">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    c.confidence_score >= 0.9
                      ? "bg-emerald-100 text-emerald-800"
                      : c.confidence_score >= 0.6
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {(c.confidence_score * 100).toFixed(0)}%
                </span>
              </td>
              <td className="p-3.5 text-slate-600 capitalize">{c.recommended_action?.replace(/_/g, " ")}</td>
              <td className="p-3.5">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    c.status === "approved"
                      ? "bg-emerald-100 text-emerald-800"
                      : c.status === "rejected"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {c.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangesTable({ data, isLoading }: { data: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
        <span className="text-xs">Loading change events...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <div className="text-sm font-semibold text-slate-500">No change events detected</div>
        <div className="text-xs text-slate-400 mt-1">Run change detection between two dataset vintages</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-100 uppercase font-mono font-semibold text-[10px]">
          <tr>
            <th className="p-3.5">Event ID</th>
            <th className="p-3.5">Parcel UID</th>
            <th className="p-3.5">Change Type</th>
            <th className="p-3.5">Confidence</th>
            <th className="p-3.5">Description</th>
            <th className="p-3.5">Verification</th>
            <th className="p-3.5 text-right">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((e) => (
            <tr key={e.id} className="hover:bg-brand-50/20 transition-colors">
              <td className="p-3.5 font-mono text-[11px] text-slate-700">{e.id?.slice(0, 8)}...</td>
              <td className="p-3.5 font-mono text-[11px]">{e.parcel_uid}</td>
              <td className="p-3.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 capitalize">
                  {e.change_type?.replace(/_/g, " ")}
                </span>
              </td>
              <td className="p-3.5 font-mono text-[11px]">{(e.confidence * 100).toFixed(0)}%</td>
              <td className="p-3.5 text-slate-600 max-w-[200px] truncate">{e.description}</td>
              <td className="p-3.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Verification Required
                </span>
              </td>
              <td className="p-3.5 text-right text-[11px] text-slate-400 font-mono">
                {new Date(e.created_at).toLocaleDateString("en-IN")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
