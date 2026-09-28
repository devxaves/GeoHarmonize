"use client";

/**
 * BhoomiSetu — Admin Console (/admin)
 *
 * Tabs:
 * 1. Add Parcel       — form with MiniMapPolygon for geometry entry
 * 2. Add Project      — form with MiniMapPolygon for alignment drawing
 * 3. Mock Adapters    — test DILRMP / LACRRIS / BhoomiRashi / PFMS mock APIs
 * Redesigned with White + Orange theme, Sora & Space Grotesk typography
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import {
  Shield,
  MapPin,
  Building2,
  Plug,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Dice5,
  Sparkles,
} from "lucide-react";
import type { Polygon, MultiPolygon } from "geojson";

const MiniMapPolygon = dynamic(() => import("@/components/map/MiniMapPolygon"), {
  ssr: false,
  loading: () => (
    <div className="h-72 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
    </div>
  ),
});

// ── Tabs ────────────────────────────────────────────────────────────────────

type Tab = "parcel" | "project" | "mock";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "parcel",  label: "Demarcate Parcel",  icon: <MapPin className="h-4 w-4" /> },
  { id: "project", label: "Register Corridor", icon: <Building2 className="h-4 w-4" /> },
  { id: "mock",    label: "Federated Adapters", icon: <Plug className="h-4 w-4" /> },
];

// ── Mock adapter keys ────────────────────────────────────────────────────────

const MOCK_ADAPTERS = [
  { key: "dilrmp",     label: "DILRMP",      color: "bg-blue-600",   desc: "Digital India Land Records Modernisation Programme" },
  { key: "lacrris",    label: "LACRRIS",     color: "bg-purple-600", desc: "Land Acquisition, Compensation, R&R Info System" },
  { key: "bhoomirashi",label: "BhoomiRashi", color: "bg-orange-600", desc: "Highway land acquisition compensation portal" },
  { key: "pfms",       label: "PFMS",        color: "bg-emerald-600",desc: "Public Financial Management System (disbursement)" },
] as const;

// ── ULPIN Auto-Generation ──────────────────────────────────────────────────

const STATE_CODES: Record<string, string> = {
  "Andhra Pradesh": "28", "Arunachal Pradesh": "12", "Assam": "18",
  "Bihar": "10", "Chhattisgarh": "22", "Goa": "30", "Gujarat": "24",
  "Haryana": "06", "Himachal Pradesh": "02", "Jharkhand": "20",
  "Karnataka": "29", "Kerala": "32", "Madhya Pradesh": "23",
  "Maharashtra": "27", "Manipur": "14", "Meghalaya": "17",
  "Mizoram": "15", "Nagaland": "13", "Odisha": "21",
  "Punjab": "03", "Rajasthan": "08", "Sikkim": "11",
  "Tamil Nadu": "33", "Telangana": "36", "Tripura": "16",
  "Uttar Pradesh": "09", "Uttarakhand": "05", "West Bengal": "19",
  "Delhi": "07", "Jammu and Kashmir": "01", "Ladakh": "38",
  "Chandigarh": "04", "Puducherry": "34", "Andaman and Nicobar Islands": "35",
  "Dadra and Nagar Haveli": "26", "Lakshadweep": "31",
};

function generateUlpin(state: string, district: string): string {
  const stateCode = STATE_CODES[state] || String(Math.floor(Math.random() * 90) + 10);
  const districtHash = district
    ? String(district.charCodeAt(0) % 10).padStart(1, "0") +
      String(district.length % 10)
    : String(Math.floor(Math.random() * 90) + 10);
  const randomPart = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  return (stateCode + districtHash + randomPart).slice(0, 14);
}

// ── Parcel Form ─────────────────────────────────────────────────────────────

function AddParcelForm() {
  const [geom, setGeom] = useState<Polygon | null>(null);
  const [form, setForm] = useState({
    project_id: "", ulpin: "", survey_number: "", village: "", district: "", state: "",
    area_hectares: "", land_type: "agricultural", ownership_status: "clear",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: projectsData } = useSWR<{ data: { id: string; name: string; district: string; state: string }[] }>(
    "/api/projects?limit=200",
    (url: string) => fetch(url).then((r) => r.json())
  );
  const projects = projectsData?.data ?? [];

  function handleField(field: string, value: string) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "project_id" && value) {
        const proj = projects.find((p) => p.id === value);
        if (proj) {
          next.district = proj.district;
          next.state = proj.state;
        }
      }
      return next;
    });
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!geom) { setResult({ ok: false, message: "Please draw the parcel boundary polygon on the map." }); return; }
    if (!form.ulpin.trim()) { setResult({ ok: false, message: "14-digit ULPIN is required." }); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ulpin: form.ulpin.trim(),
          project_id: form.project_id || undefined,
          survey_number: form.survey_number || undefined,
          village: form.village || undefined,
          district: form.district || undefined,
          state: form.state || undefined,
          area_hectares: form.area_hectares ? parseFloat(form.area_hectares) : undefined,
          land_type: form.land_type,
          geometry_geojson: geom,
          ownership_status: form.ownership_status,
          litigation_flag: Boolean((form as any).litigation_flag),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create parcel");

      let riskMsg = "";
      if (data.data?.id) {
        try {
          const riskRes = await fetch("/api/risk/compute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entityType: "parcel", entityId: data.data.id, persist: true }),
          });
          const riskData = await riskRes.json();
          if (riskData.success) {
            riskMsg = ` • Initial Risk Score: ${riskData.score.toFixed(1)}/100 (${riskData.riskCategory.toUpperCase()})`;
          }
        } catch {
          // non-blocking
        }
      }

      setResult({ ok: true, message: `Parcel ${form.ulpin} created — ID: ${data.data?.id}${riskMsg}` });
      setForm({ project_id: "", ulpin: "", survey_number: "", village: "", district: "", state: "", area_hectares: "", land_type: "agricultural", ownership_status: "clear" });
      setGeom(null);
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Left: field inputs */}
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-heading font-bold text-slate-900">Parcel Identity & Boundary</h2>

        {/* Project selector */}
        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1 block">
            Link to Corridor <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <select
            value={form.project_id}
            onChange={(e) => handleField("project_id", e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-700"
          >
            <option value="">— Standalone Parcel (No Corridor) —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.district}, {p.state})
              </option>
            ))}
          </select>
          {form.project_id && (
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              ✓ State & district auto-linked from selected project corridor.
            </p>
          )}
        </div>

        {[
          { label: "ULPIN / Bhu-Aadhaar (14-digit)", field: "ulpin", placeholder: "e.g. 27010100012345", required: true, autoGen: true },
          { label: "Revenue Survey Number", field: "survey_number", placeholder: "e.g. 45/2A" },
          { label: "Revenue Village", field: "village", placeholder: "e.g. Bhimashankar" },
          { label: "District", field: "district", placeholder: "e.g. Pune" },
          { label: "State", field: "state", placeholder: "e.g. Maharashtra" },
          { label: "Demarcated Area (hectares)", field: "area_hectares", placeholder: "e.g. 2.45" },
        ].map(({ label, field, placeholder, required, autoGen }) => (
          <div key={field}>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              {label} {required && <span className="text-orange-600">*</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={placeholder}
                value={form[field as keyof typeof form]}
                onChange={(e) => handleField(field, e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-800"
              />
              {autoGen && (
                <button
                  type="button"
                  onClick={() => {
                    const ulpin = generateUlpin(form.state, form.district);
                    handleField("ulpin", ulpin);
                  }}
                  title="Auto-generate 14-digit ULPIN"
                  className="px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl hover:bg-orange-100 transition-colors flex items-center gap-1 text-xs font-semibold shrink-0 cursor-pointer"
                >
                  <Dice5 className="h-3.5 w-3.5 text-orange-600" />
                  Auto ULPIN
                </button>
              )}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Land Classification</label>
            <select
              value={form.land_type}
              onChange={(e) => handleField("land_type", e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-700"
            >
              {["agricultural", "commercial", "forest", "residential", "government", "other"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Ownership Record</label>
            <select
              value={form.ownership_status}
              onChange={(e) => handleField("ownership_status", e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-700"
            >
              <option value="clear">Clear Title</option>
              <option value="disputed">Disputed Title</option>
              <option value="under_verification">Under Verification</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="litigation_flag"
            checked={(form as any).litigation_flag ?? false}
            onChange={(e) => handleField("litigation_flag", e.target.checked ? "true" : "")}
            className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
          />
          <label htmlFor="litigation_flag" className="text-xs font-medium text-slate-700 cursor-pointer">
            Active Civil / High Court Stay Petition Flag
          </label>
        </div>

        {result && (
          <div className={`flex items-start gap-2 text-xs font-medium rounded-xl p-3 ${result.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {result.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />}
            {result.message}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl text-xs font-semibold uppercase tracking-wider font-mono shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer mt-2"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Demarcating…" : "Create Parcel & Compute Risk"}
        </button>
      </div>

      {/* Right: polygon draw */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700 block">
          Demarcate Cadastral Polygon on Map *
        </label>
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <MiniMapPolygon value={geom} onChange={setGeom} height={420} />
        </div>
        <p className="text-[11px] text-slate-400">
          Click on the spatial viewer to place vertices and enclose the parcel boundary.
        </p>
      </div>
    </form>
  );
}

// ── Project Form ────────────────────────────────────────────────────────────

function AddProjectForm() {
  const [geom, setGeom] = useState<Polygon | null>(null);
  const [form, setForm] = useState({
    name: "", land_requiring_body: "", ministry: "", state: "", district: "",
    project_type: "highway",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          alignment_geojson: geom ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create project");
      setResult({ ok: true, message: `Project "${form.name}" registered — ID: ${data.data?.id}` });
      setForm({ name: "", land_requiring_body: "", ministry: "", state: "", district: "", project_type: "highway" });
      setGeom(null);
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-heading font-bold text-slate-900">Statutory Project Profile</h2>
        {[
          { label: "Corridor / Project Name", field: "name", placeholder: "e.g. NH-48 Widening Phase II", required: true },
          { label: "Land Requiring Body (Agency)", field: "land_requiring_body", placeholder: "e.g. NHAI", required: true },
          { label: "Sponsoring Ministry", field: "ministry", placeholder: "e.g. MoRTH" },
          { label: "State", field: "state", placeholder: "e.g. Maharashtra", required: true },
          { label: "District", field: "district", placeholder: "e.g. Pune", required: true },
        ].map(({ label, field, placeholder, required }) => (
          <div key={field}>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              {label} {required && <span className="text-orange-600">*</span>}
            </label>
            <input
              type="text"
              placeholder={placeholder}
              value={form[field as keyof typeof form]}
              onChange={(e) => handleField(field, e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-800"
            />
          </div>
        ))}

        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1 block">Project Typology</label>
          <select
            value={form.project_type}
            onChange={(e) => handleField("project_type", e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-slate-700"
          >
            {["highway", "railway", "irrigation", "industrial_corridor", "power_line", "pipeline", "other"].map((v) => (
              <option key={v} value={v}>{v.replace("_", " ")}</option>
            ))}
          </select>
        </div>

        {result && (
          <div className={`flex items-start gap-2 text-xs font-medium rounded-xl p-3 ${result.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {result.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />}
            {result.message}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl text-xs font-semibold uppercase tracking-wider font-mono shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer mt-2"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Registering…" : "Register Infrastructure Corridor"}
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700 block">
          Corridor Spatial Alignment (Optional)
        </label>
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <MiniMapPolygon value={geom} onChange={setGeom} height={420} />
        </div>
        <p className="text-[11px] text-slate-400">
          Draw the linear alignment corridor geometry or upload GeoJSON later via the Spatial Atlas.
        </p>
      </div>
    </form>
  );
}

// ── Mock Adapters Panel ─────────────────────────────────────────────────────

function MockAdaptersPanel() {
  const [results, setResults] = useState<Record<string, { loading: boolean; data: Record<string, unknown> | null; error: string | null }>>({});

  const { data: logsData, mutate: mutateLogs, isValidating: logsLoading } = useSWR<{
    success: boolean;
    count: number;
    logs: { id: string; source: string; request: any; response: any; called_at: string }[];
  }>("/api/mock/logs", (url: string) => fetch(url).then((r) => r.json()));

  const logs = logsData?.logs ?? [];

  async function callAdapter(key: string) {
    setResults((prev) => ({ ...prev, [key]: { loading: true, data: null, error: null } }));
    try {
      const res = await fetch(`/api/mock/${key}`, { method: "GET" });
      const data = await res.json();
      setResults((prev) => ({ ...prev, [key]: { loading: false, data, error: null } }));
      mutateLogs();
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [key]: { loading: false, data: null, error: (err as Error).message },
      }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
          <Plug className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-heading font-bold text-slate-900">Federated Integration Adapters</h2>
          <p className="text-xs text-slate-400">
            Simulate inter-agency data synchronization. All payloads are marked <code className="bg-slate-100 text-orange-700 px-1 rounded font-mono">mock-*</code>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK_ADAPTERS.map(({ key, label, color, desc }) => {
          const state = results[key];
          return (
            <div key={key} className="border border-slate-200/80 rounded-2xl p-5 bg-white shadow-sm hover:border-orange-200 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white ${color}`}>
                    MOCK
                  </span>
                  <span className="font-heading font-bold text-slate-900 text-sm">{label}</span>
                </div>
                <button
                  onClick={() => callAdapter(key)}
                  disabled={state?.loading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition-all cursor-pointer font-mono"
                >
                  {state?.loading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Ping
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">{desc}</p>

              {state?.error && (
                <div className="text-xs text-red-600 bg-red-50 rounded-xl p-3 border border-red-200 font-mono">
                  ⚠ {state.error}
                </div>
              )}
              {state?.data && !state.loading && (
                <pre className="text-[11px] bg-slate-50 rounded-xl p-3 overflow-x-auto max-h-40 border border-slate-100 font-mono text-slate-700">
                  {JSON.stringify(state.data as Record<string, unknown>, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-slate-600 bg-orange-50/60 border border-orange-200 rounded-2xl p-4 flex items-start gap-2.5">
        <Sparkles className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
        <div>
          <strong className="text-orange-900">Federated Audit Log:</strong> Every ping logs an immutable transaction record to <code className="bg-orange-100/80 rounded px-1 font-mono font-bold text-orange-800">mock_adapter_log</code> to simulate cross-ministerial accountability.
        </div>
      </div>

      {/* Live Mock Adapter Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
              Live Mock Adapter Log (mock_adapter_log Table)
            </h3>
            <p className="text-[11px] text-slate-400 font-sans">Audit of all inbound and outbound federated payloads</p>
          </div>
          <button
            onClick={() => mutateLogs()}
            disabled={logsLoading}
            className="text-xs px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`h-3 w-3 ${logsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-400 border-b border-slate-100 text-[10px] uppercase font-mono font-semibold">
              <tr>
                <th className="p-3">Source</th>
                <th className="p-3">Request Payload</th>
                <th className="p-3">Response Payload</th>
                <th className="p-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 font-sans">
                    No mock adapter calls recorded yet. Click &quot;Ping&quot; above to log an integration call.
                  </td>
                </tr>
              ) : (
                logs.map((log: { id: string; source: string; request: unknown; response: unknown; called_at: string }) => (
                  <tr key={log.id} className="hover:bg-orange-50/20 transition-colors">
                    <td className="p-3 font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px]">
                        {log.source}
                      </span>
                    </td>
                    <td className="p-3 max-w-[200px] truncate text-slate-600">
                      {typeof log.request === "object" ? JSON.stringify(log.request) : String(log.request ?? "")}
                    </td>
                    <td className="p-3 max-w-[260px] truncate text-slate-600">
                      {typeof log.response === "object" ? JSON.stringify(log.response) : String(log.response ?? "")}
                    </td>
                    <td className="p-3 text-right text-slate-400 font-sans text-[10px]">
                      {new Date(log.called_at).toLocaleTimeString("en-IN")}
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

// ── Page ────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("parcel");

  return (
    <div className="min-h-screen bg-[#fafaf9] py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Decorative ambient background */}
      <div className="absolute top-0 right-10 w-96 h-96 bg-orange-100/40 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm flex items-center gap-4 relative overflow-hidden animate-fade-in">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-500 to-amber-500" />
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 mb-1">
              <Sparkles className="w-3 h-3 text-orange-500" />
              Administrative Operations Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 tracking-tight">
              Land Administration & Integrations
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Demarcate parcel cadastral boundaries, register infrastructure corridors, and test federated mock adapters.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-100/90 rounded-2xl w-fit border border-slate-200/60 animate-fade-in">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-white text-orange-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 animate-fade-in">
          {activeTab === "parcel"  && <AddParcelForm />}
          {activeTab === "project" && <AddProjectForm />}
          {activeTab === "mock"    && <MockAdaptersPanel />}
        </div>
      </div>
    </div>
  );
}