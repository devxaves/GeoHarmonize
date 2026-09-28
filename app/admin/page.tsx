"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import DemarcateParcelPanel, { REGISTRY_KEY } from "@/components/admin/DemarcateParcelPanel";

import {
  Shield,
  Database,
  Activity,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  MapPin,
  RefreshCw,
  ChevronRight,
  Server,
  GitBranch,
  Eye,
  Scale,
  PenLine,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Tab = "demarcate" | "datasets" | "pipeline";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "demarcate", label: "Demarcate Parcel", icon: <PenLine className="h-4 w-4" /> },
  { id: "datasets", label: "Dataset Registry", icon: <Database className="h-4 w-4" /> },
  { id: "pipeline", label: "Pipeline Run History", icon: <Activity className="h-4 w-4" /> },
];

function DatasetRegistry() {
  const { data, isValidating, mutate } = useSWR<{ parcels?: any[] }>(REGISTRY_KEY, fetcher, {
    revalidateOnFocus: false,
  });

  const [filter, setFilter] = useState("all");

  const datasets = data?.parcels || [];
  const filtered = filter === "all" ? datasets : datasets.filter((d: any) => d.source_system === filter);

  const sourceTypes = [...new Set(datasets.map((d: any) => d.source_system).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {filtered.length} datasets registered
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
          >
            <option value="all">All Sources</option>
            {sourceTypes.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <button
            onClick={() => mutate()}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? "animate-spin text-brand-600" : "text-slate-500"}`} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-100 uppercase font-mono font-semibold text-[10px]">
              <tr>
                <th className="p-3">Parcel UID</th>
                <th className="p-3">Source</th>
                <th className="p-3">Survey No.</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Area (sqm)</th>
                <th className="p-3">Status</th>
                <th className="p-3">Version</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <Database className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <div className="text-sm font-semibold text-slate-500">No datasets found</div>
                    <div className="text-xs text-slate-400 mt-1">Upload a dataset to get started</div>
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 50).map((d: any) => (
                  <tr key={d.parcel_uid} className="hover:bg-brand-50/20 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-slate-700">{d.parcel_uid}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {d.source_system || "unknown"}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px]">{d.survey_number || "N/A"}</td>
                    <td className="p-3 text-slate-700">{d.owner_name || "Unknown"}</td>
                    <td className="p-3 font-mono text-[11px]">{d.geometry_area_sqm?.toFixed(0) || "N/A"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          d.validation_status === "auto_linked"
                            ? "bg-emerald-100 text-emerald-800"
                            : d.validation_status === "human_approved"
                            ? "bg-blue-100 text-blue-800"
                            : d.validation_status === "rejected"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {d.validation_status || "unverified"}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px]">v{d.version || 1}</td>
                    <td className="p-3 text-right">
                      <a
                        href={`/atlas?parcel=${d.parcel_uid}`}
                        className="text-brand-600 hover:text-brand-700 font-semibold text-[11px]"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PipelineHistory() {
  const { data, isValidating } = useSWR<{ conflicts: any[] }>("/api/conflicts?limit=100", fetcher, {
    revalidateOnFocus: false,
  });

  const conflicts = data?.conflicts || [];

  const runs = [
    {
      id: "run-001",
      timestamp: "2025-01-15 14:30:00",
      dataset: "cadastral_ward_01",
      parcels: 200,
      conflicts: 45,
      autoLinked: 30,
      status: "completed",
    },
    {
      id: "run-002",
      timestamp: "2025-01-15 14:35:00",
      dataset: "drone_ward_01",
      parcels: 195,
      conflicts: 42,
      autoLinked: 28,
      status: "completed",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          {runs.length} pipeline runs
        </span>
      </div>

      <div className="space-y-3">
        {runs.map((run) => (
          <motion.div
            key={run.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-slate-200 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-brand-100 text-brand-600 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{run.dataset}</div>
                  <div className="text-xs text-slate-500 font-mono">{run.timestamp}</div>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  run.status === "completed"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {run.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-md text-center">
                <div className="text-lg font-bold text-slate-900 font-mono">{run.parcels}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Parcels</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-md text-center">
                <div className="text-lg font-bold text-brand-600 font-mono">{run.conflicts}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Conflicts</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-md text-center">
                <div className="text-lg font-bold text-emerald-600 font-mono">{run.autoLinked}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Auto-Linked</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-md text-center">
                <div className="text-lg font-bold text-amber-600 font-mono">
                  {run.conflicts - run.autoLinked}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">For Review</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-slate-50 rounded-lg border border-slate-200 p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Pipeline Stages</h3>
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {[
            { name: "Ingest", icon: Database, status: "done" },
            { name: "CRS", icon: Server, status: "done" },
            { name: "Topology", icon: GitBranch, status: "done" },
            { name: "Match", icon: Layers, status: "done" },
            { name: "Score", icon: Scale, status: "done" },
            { name: "Review", icon: Eye, status: "active" },
            { name: "Publish", icon: CheckCircle2, status: "pending" },
          ].map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.name}
                className={`p-3 rounded-md text-center border ${
                  stage.status === "done"
                    ? "bg-emerald-50 border-emerald-200"
                    : stage.status === "active"
                    ? "bg-brand-50 border-brand-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <Icon
                  className={`w-4 h-4 mx-auto mb-1 ${
                    stage.status === "done"
                      ? "text-emerald-600"
                      : stage.status === "active"
                      ? "text-brand-600"
                      : "text-slate-400"
                  }`}
                />
                <div
                  className={`text-[10px] font-bold ${
                    stage.status === "done"
                      ? "text-emerald-700"
                      : stage.status === "active"
                      ? "text-brand-700"
                      : "text-slate-500"
                  }`}
                >
                  {stage.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("demarcate");

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 sm:p-8 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center text-brand-700">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-brand-700 mb-0.5">Admin Console</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              System Administration
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Demarcate parcel boundaries on the map, browse the parcel registry and review pipeline runs.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-100/90 rounded-lg w-fit border border-slate-200/60">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

        {/* Tab content */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sm:p-8">
          {activeTab === "demarcate" && <DemarcateParcelPanel />}
          {activeTab === "datasets" && <DatasetRegistry />}
          {activeTab === "pipeline" && <PipelineHistory />}
        </div>
      </div>
    </div>
  );
}
