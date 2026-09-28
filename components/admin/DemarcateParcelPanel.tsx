"use client";

/**
 * GeoSync — Manual Parcel Demarcation (Admin)
 *
 * Lets a land-records officer draw a parcel boundary by hand (field GNSS
 * survey, tracing an orthophoto, digitising a paper cadastral sheet) and
 * register it in urban_parcel. The drawn parcel goes through the same
 * matching + confidence scoring as any uploaded dataset, so overlaps with
 * existing parcels land in the conflict review queue instead of silently
 * overwriting anything (PRD §1, §5).
 */

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { AnimatePresence, motion } from "framer-motion";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Dice5,
  Loader2,
  Plane,
  Radio,
  ScrollText,
  SearchCheck,
  Building,
  Map as MapIcon,
  Save,
} from "lucide-react";
import { formatArea, ringAreaSqm } from "@/components/map/MiniMapPolygon";

const MiniMapPolygon = dynamic(() => import("@/components/map/MiniMapPolygon"), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
    </div>
  ),
});

const fetcher = (url: string) => fetch(url).then((r) => r.json());
export const REGISTRY_KEY = "/api/parcels?limit=1000";

// ── Survey basis → source_type (reliability weights mirror geo-engine config) ──

const SURVEY_BASIS = [
  { id: "gnss", label: "GNSS field survey", weight: 0.95, icon: Radio, hint: "Vertices walked with DGPS / RTK" },
  { id: "drone_ori", label: "Drone orthophoto", weight: 0.9, icon: Plane, hint: "Traced on ORI imagery" },
  { id: "cadastral", label: "Cadastral sheet", weight: 0.8, icon: MapIcon, hint: "Digitised from village map" },
  { id: "municipal", label: "Municipal GIS", weight: 0.75, icon: Building, hint: "ULB property layer" },
  { id: "revenue", label: "Revenue record", weight: 0.7, icon: ScrollText, hint: "Sketch from RoR / 7-12" },
] as const;

type SurveyBasis = (typeof SURVEY_BASIS)[number]["id"];

const LAND_USES = ["residential", "commercial", "agricultural", "industrial", "mixed", "vacant"];

// ── ULPIN generator (carried over from BhoomiSetu, PRD §9 Phase 0) ──────────

const STATE_CODES: Record<string, string> = {
  "Andhra Pradesh": "28", "Arunachal Pradesh": "12", "Assam": "18", "Bihar": "10",
  "Chhattisgarh": "22", "Goa": "30", "Gujarat": "24", "Haryana": "06",
  "Himachal Pradesh": "02", "Jharkhand": "20", "Karnataka": "29", "Kerala": "32",
  "Madhya Pradesh": "23", "Maharashtra": "27", "Manipur": "14", "Meghalaya": "17",
  "Mizoram": "15", "Nagaland": "13", "Odisha": "21", "Punjab": "03",
  "Rajasthan": "08", "Sikkim": "11", "Tamil Nadu": "33", "Telangana": "36",
  "Tripura": "16", "Uttar Pradesh": "09", "Uttarakhand": "05", "West Bengal": "19",
  "Delhi": "07", "Jammu and Kashmir": "01", "Ladakh": "38", "Chandigarh": "04",
  "Puducherry": "34",
};

function generateUlpin(state: string, district: string): string {
  const stateCode = STATE_CODES[state.trim()] || String(Math.floor(Math.random() * 90) + 10);
  const districtPart = district.trim()
    ? String(district.trim().charCodeAt(0) % 10) + String(district.trim().length % 10)
    : String(Math.floor(Math.random() * 90) + 10);
  const randomPart = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  return (stateCode + districtPart + randomPart).slice(0, 14);
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ScoreReason {
  factor: string;
  weight: number;
  raw_value: number;
  contribution: number;
  explanation: string;
}

interface Match {
  conflict_id: string | null;
  parcel_uid: string;
  survey_number: string | null;
  owner_name: string | null;
  source_type: string;
  geometry: Polygon;
  score: number;
  score_reasons: ScoreReason[];
  recommended_action: "auto_merge" | "human_review" | "reject";
  conflict_type: string;
  difference_value: number | null;
}

interface DemarcationResult {
  dry_run: boolean;
  parcel_uid: string;
  geometry_area_sqm: number;
  geometry_repaired: boolean;
  initial_status: string;
  dataset_id?: string;
  audit_logged?: boolean;
  area_check: {
    recorded_area_sqm: number;
    drawn_area_sqm: number;
    difference_pct: number;
    requires_verification: boolean;
  } | null;
  matches: Match[];
}

const EMPTY_FORM = {
  survey_number: "", plot_number: "", property_id: "", ulpin: "", owner_name: "",
  state: "", district: "", ulb: "", ward: "",
  land_use: "residential", recorded_area_sqm: "", surveyed_by: "", notes: "",
};

const ACTION_STYLE: Record<Match["recommended_action"], { label: string; cls: string; bar: string }> = {
  auto_merge: { label: "Auto-link", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", bar: "bg-emerald-500" },
  human_review: { label: "Human review", cls: "bg-amber-50 text-amber-800 border-amber-200", bar: "bg-amber-500" },
  reject: { label: "Distinct parcel", cls: "bg-slate-100 text-slate-700 border-slate-200", bar: "bg-slate-400" },
};

// ── Component ───────────────────────────────────────────────────────────────

export default function DemarcateParcelPanel() {
  const { mutate } = useSWRConfig();
  const [geom, setGeom] = useState<Polygon | null>(null);
  const [basis, setBasis] = useState<SurveyBasis>("gnss");
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState<"check" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemarcationResult | null>(null);

  const { data: registry, error: registryError } = useSWR<{ parcels?: any[] }>(REGISTRY_KEY, fetcher, {
    revalidateOnFocus: false,
  });

  // Existing parcels as map context; parcels matched by the last check are highlighted
  const referenceParcels = useMemo<FeatureCollection>(() => {
    const matched = new Set(result?.matches.map((m) => m.parcel_uid) ?? []);
    const features: Feature[] = (registry?.parcels ?? [])
      .filter((p) => p.geometry?.type === "Polygon")
      .map((p) => ({
        type: "Feature",
        geometry: p.geometry,
        properties: { parcel_uid: p.parcel_uid, highlight: matched.has(p.parcel_uid) },
      }));
    return { type: "FeatureCollection", features };
  }, [registry, result]);

  function setField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  function handleGeomChange(g: Polygon | null) {
    setGeom(g);
    // A new boundary invalidates the last match preview
    if (result?.dry_run) setResult(null);
  }

  async function submit(dryRun: boolean) {
    setError(null);
    if (!geom) return setError("Draw the parcel boundary on the map first.");
    if (!form.survey_number.trim()) return setError("Survey number is required to identify the parcel.");
    if (!form.state.trim() || !form.district.trim()) return setError("State and district are required for the parcel UID.");
    const recordedArea = form.recorded_area_sqm ? Number(form.recorded_area_sqm) : undefined;
    if (recordedArea !== undefined && !(recordedArea > 0)) return setError("Recorded area must be a positive number in sqm.");

    setBusy(dryRun ? "check" : "save");
    try {
      const res = await fetch("/api/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geometry: geom,
          survey_basis: basis,
          survey_number: form.survey_number,
          plot_number: form.plot_number || undefined,
          property_id: form.property_id || undefined,
          ulpin: form.ulpin || undefined,
          owner_name: form.owner_name || undefined,
          state: form.state,
          district: form.district,
          ulb: form.ulb || "UNK",
          ward: form.ward || "UNK",
          land_use: form.land_use,
          recorded_area_sqm: recordedArea,
          surveyed_by: form.surveyed_by || undefined,
          notes: form.notes || undefined,
          dry_run: dryRun,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
      if (!dryRun) {
        // Keep location fields so the officer can demarcate the neighbouring parcel quickly
        setForm((f) => ({ ...EMPTY_FORM, state: f.state, district: f.district, ulb: f.ulb, ward: f.ward, surveyed_by: f.surveyed_by, land_use: f.land_use }));
        setGeom(null);
        mutate(REGISTRY_KEY);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const inputCls =
    "w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 text-slate-800 placeholder:text-slate-400";
  const labelCls = "text-[11px] font-semibold text-slate-600 mb-1 block";

  const field = (key: keyof typeof EMPTY_FORM, label: string, placeholder: string, required = false, extra?: ReactNode) => (
    <div>
      <label className={labelCls}>
        {label} {required && <span className="text-crimson-600">*</span>}
      </label>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={form[key]}
          placeholder={placeholder}
          onChange={(e) => setField(key, e.target.value)}
          className={`${inputCls} ${key === "ulpin" || key === "survey_number" ? "font-mono tabular-nums" : ""}`}
        />
        {extra}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Form ─────────────────────────────────────────────── */}
        <div className="lg:col-span-5 space-y-5">
          <section>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">1 · Survey basis</h3>
            <p className="text-[11px] text-slate-500 mb-2.5">
              What the boundary was drawn from. This sets the source-reliability factor in the confidence score.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SURVEY_BASIS.map(({ id, label, weight, icon: Icon, hint }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBasis(id)}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                    basis === id
                      ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                      : "border-slate-200 hover:border-brand-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${basis === id ? "text-brand-600" : "text-slate-400"}`} />
                  <span className="min-w-0">
                    <span className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-800">
                      {label}
                      <span className="font-mono tabular-nums text-[10px] text-slate-500">{Math.round(weight * 100)}%</span>
                    </span>
                    <span className="block text-[10px] text-slate-500 truncate">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">2 · Parcel identity</h3>
            <div className="grid grid-cols-2 gap-3">
              {field("survey_number", "Survey / Khasra no.", "e.g. 45/2A", true)}
              {field("plot_number", "Plot no.", "e.g. P-112")}
            </div>
            {field("owner_name", "Owner / occupant name", "As per record of rights")}
            <div className="grid grid-cols-2 gap-3">
              {field("property_id", "Municipal property ID", "e.g. PMC-0045-221")}
              <div>
                <label className={labelCls}>Land use</label>
                <select value={form.land_use} onChange={(e) => setField("land_use", e.target.value)} className={`${inputCls} capitalize`}>
                  {LAND_USES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            {field(
              "ulpin",
              "ULPIN / Bhu-Aadhaar (14-digit)",
              "Leave blank if not yet assigned",
              false,
              <button
                type="button"
                onClick={() => setField("ulpin", generateUlpin(form.state, form.district))}
                title="Generate a 14-digit ULPIN from state and district"
                className="px-2.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 text-[11px] font-semibold flex items-center gap-1 shrink-0"
              >
                <Dice5 className="h-3.5 w-3.5" /> Generate
              </button>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">3 · Location &amp; area</h3>
            <div className="grid grid-cols-2 gap-3">
              {field("state", "State", "e.g. Maharashtra", true)}
              {field("district", "District", "e.g. Pune", true)}
              {field("ulb", "ULB / Tehsil", "e.g. PMC")}
              {field("ward", "Ward / Village", "e.g. W12")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Recorded area (sqm)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.recorded_area_sqm}
                  placeholder="From revenue record"
                  onChange={(e) => setField("recorded_area_sqm", e.target.value)}
                  className={`${inputCls} font-mono tabular-nums`}
                />
              </div>
              {field("surveyed_by", "Surveyed by", "Officer name / ID")}
            </div>
            <div>
              <label className={labelCls}>Field notes</label>
              <textarea
                rows={2}
                value={form.notes}
                placeholder="Monuments found, neighbour consent, disputes noted on site…"
                onChange={(e) => setField("notes", e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </div>
          </section>

          {error && (
            <div className="flex items-start gap-2 text-xs rounded-lg p-3 bg-red-50 text-red-800 border border-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={busy !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-brand-300 text-brand-700 bg-white hover:bg-brand-50 text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {busy === "check" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
              Check against registry
            </button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => submit(false)}
              disabled={busy !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
            >
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Register parcel
            </motion.button>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Registering never overwrites an existing parcel. Overlaps are scored and sent to the conflict review
            queue, and the entry is written to the audit log.
          </p>
        </div>

        {/* ── Map ──────────────────────────────────────────────── */}
        <div className="lg:col-span-7 space-y-2">
          <MiniMapPolygon value={geom} onChange={handleGeomChange} height={480} referenceParcels={referenceParcels} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-amber-500 bg-amber-500/25" /> Your boundary
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border border-brand-600 bg-brand-600/10" />
              Registered parcels{" "}
              {registry?.parcels ? (
                <span className="font-mono tabular-nums">({referenceParcels.features.length})</span>
              ) : registryError ? (
                <span className="text-red-600">(unavailable)</span>
              ) : (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-crimson-600 bg-crimson-500/30" /> Overlapping / matched
            </span>
          </div>
          {geom && form.recorded_area_sqm && Number(form.recorded_area_sqm) > 0 && (
            <AreaComparison drawn={ringAreaSqm(geom.coordinates[0] as [number, number][])} recorded={Number(form.recorded_area_sqm)} />
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {result && <ResultPanel key={`${result.parcel_uid}-${result.dry_run}`} result={result} />}
      </AnimatePresence>
    </div>
  );
}

// ── Helpers & sub-components ──────────────────────────────────────────────────

function AreaComparison({ drawn, recorded }: { drawn: number; recorded: number }) {
  const diffPct = (Math.abs(drawn - recorded) / recorded) * 100;
  const flagged = diffPct > 10;
  return (
    <div className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 border ${flagged ? "rag-amber" : "rag-green"}`}>
      <span>
        Drawn <span className="font-mono tabular-nums font-semibold">{formatArea(drawn)}</span> vs recorded{" "}
        <span className="font-mono tabular-nums font-semibold">{formatArea(recorded)}</span>
      </span>
      <span className="font-mono tabular-nums font-semibold">
        {diffPct.toFixed(1)}% {flagged ? "· verification required" : "· within tolerance"}
      </span>
    </div>
  );
}

function ResultPanel({ result }: { result: DemarcationResult }) {
  const saved = !result.dry_run;
  const reviewCount = result.matches.filter((m) => m.recommended_action === "human_review").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg border border-slate-200 overflow-hidden"
    >
      <div className={`px-5 py-4 border-b ${saved ? "bg-emerald-50 border-emerald-200" : "bg-brand-50 border-brand-200"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            {saved ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
            ) : (
              <SearchCheck className="h-5 w-5 text-brand-600 mt-0.5" />
            )}
            <div>
              <div className="text-sm font-bold text-slate-900">
                {saved ? "Parcel registered" : "Registry check (nothing saved yet)"}
              </div>
              <div className="font-mono text-[11px] text-slate-600 mt-0.5 break-all">{result.parcel_uid}</div>
            </div>
          </div>
          {saved && reviewCount > 0 && (
            <Link
              href="/atlas"
              className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              Open review queue <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Stat label="Drawn area" value={formatArea(result.geometry_area_sqm)} />
          <Stat label="Status" value={(result.initial_status || "unverified").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())} />
          <Stat label="Nearby matches" value={String(result.matches.length)} />
          <Stat
            label={saved ? "Audit log" : "Area vs record"}
            value={
              saved
                ? result.audit_logged ? "Recorded" : "Not recorded"
                : result.area_check ? `${result.area_check.difference_pct}% diff` : "No record"
            }
          />
        </div>
        {result.geometry_repaired && (
          <p className="text-[11px] text-amber-800 mt-3">
            The drawn ring was self-intersecting at a vertex and was repaired automatically (make_valid).
          </p>
        )}
        {result.area_check?.requires_verification && (
          <p className="text-[11px] text-amber-800 mt-2">
            Drawn area differs from the recorded area by {result.area_check.difference_pct}% — field verification required.
          </p>
        )}
      </div>

      <div className="p-5 space-y-3 bg-white">
        {result.matches.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-7 w-7 mx-auto text-emerald-500 mb-2" />
            <div className="text-sm font-semibold text-slate-700">No existing parcel within ~100 m</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {saved ? "Registered as a new parcel with no conflicts." : "This boundary would be registered as a new parcel."}
            </div>
          </div>
        ) : (
          <>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {saved ? "Conflicts created for review" : "Parcels this boundary would be matched against"}
            </h4>
            {result.matches.map((m, i) => (
              <MatchCard key={m.parcel_uid} match={m} index={i} />
            ))}
          </>
        )}
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/80 rounded-md border border-slate-200/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 font-mono tabular-nums truncate">{value}</div>
    </div>
  );
}

function MatchCard({ match, index }: { match: Match; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const style = ACTION_STYLE[match.recommended_action] ?? ACTION_STYLE.reject;
  const pct = Math.round(match.score * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="border border-slate-200 rounded-lg overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] text-slate-800 truncate">{match.parcel_uid}</div>
          <div className="text-[11px] text-slate-500 truncate">
            Survey {match.survey_number || "—"} · {match.owner_name || "Owner unknown"} · {match.source_type} ·{" "}
            {match.conflict_type.replace(/_/g, " ")}
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${style.cls}`}>{style.label}</span>
        <div className="w-28">
          <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
            <span>Confidence</span>
            <span className="font-mono tabular-nums font-semibold text-slate-800">{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(3, pct)}%` }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className={`h-full ${style.bar}`}
            />
          </div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-100">
              {match.score_reasons.map((r) => (
                <div key={r.factor} className="text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-semibold text-slate-700 capitalize">
                      {r.factor.replace(/_/g, " ")}{" "}
                      <span className="font-normal text-slate-400">(wt {Math.round(r.weight * 100)}%)</span>
                    </span>
                    <span className="font-mono tabular-nums text-slate-700">
                      {Math.round(r.raw_value * 100)}% · +{(r.contribution * 100).toFixed(1)}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden my-1">
                    <div className="h-full bg-brand-500" style={{ width: `${Math.max(2, r.raw_value * 100)}%` }} />
                  </div>
                  <div className="text-slate-500 leading-snug">{r.explanation}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
