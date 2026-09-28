/**
 * GeoHarmonize — Domain-Specific NER (Named Entity Recognition)
 *
 * Two-stage pipeline:
 *   Stage 1: HuggingFace BERT-NER (dslim/bert-base-NER) via Inference API
 *            → falls back to regex if API key missing or request fails
 *   Stage 2: Regex fallback with land-record domain patterns
 *
 * Entity types extracted (all new — ZERO overlap with old FRA patterns):
 *   - ULPIN       : 14-digit Bhu-Aadhaar unique parcel identifier
 *   - SURVEY_NO   : Indian survey number (e.g. 45/2A, 123-B, Gut No. 78)
 *   - SECTION_REF : Section reference (Sec 11 / Sec 19 / Sec 23 / Sec 26 / Sec 38)
 *   - NOTIF_DATE  : Notification / award date (DD/MM/YYYY, DD-MM-YYYY, DD Month YYYY)
 *   - AWARD_AMOUNT: Compensation award amount in INR (₹, Rs., Lakh, Crore)
 *   - AREA_HA     : Land area in hectares / acres / sq metres
 *   - DISTRICT    : Indian district name (regex + BERT cross-reference)
 *   - VILLAGE     : Village / gram panchayat / mouza name
 *   - OWNER_NAME  : Landowner name (BERT NER PER tag)
 *   - PROJECT_REF : Project / scheme reference number
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface NEREntity {
  type: EntityType;
  value: string;
  normalised?: string | number;   // cleaned value (e.g. hectares as float)
  confidence: number;             // 0–1, 1 = regex exact match, <1 = BERT
  source: "bert" | "regex";
  charStart?: number;
  charEnd?: number;
}

export type EntityType =
  | "ULPIN"
  | "SURVEY_NO"
  | "SECTION_REF"
  | "NOTIF_DATE"
  | "AWARD_AMOUNT"
  | "AREA_HA"
  | "DISTRICT"
  | "VILLAGE"
  | "OWNER_NAME"
  | "PROJECT_REF";

export interface NERResult {
  entities: NEREntity[];
  summary: ExtractedSummary;
  bertUsed: boolean;
  regexFallback: boolean;
}

/** The clean, de-duplicated extraction used downstream for discrepancy checks */
export interface ExtractedSummary {
  ulpins: string[];
  surveyNumbers: string[];
  sectionRefs: string[];
  dates: string[];
  awardAmountInr: number | null;
  areaHectares: number | null;
  districts: string[];
  villages: string[];
  ownerNames: string[];
  projectRef: string | null;
}

// ── Regex Patterns — Land Acquisition Domain ──────────────────────────────────

/** 14-digit ULPIN (Bhu-Aadhaar) — may be space/dash separated in docs */
const ULPIN_RE = /\b(\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4})\b/g;

/** Survey / khasra / gut / gat numbers — various Indian formats */
const SURVEY_RE =
  /(?:survey\s*no\.?|s\.no\.?|khasra\s*no\.?|gut\s*no\.?|gat\s*no\.?|plot\s*no\.?|field\s*no\.?)\s*:?\s*([A-Za-z0-9/\-]+(?:\s*[A-Za-z0-9/\-]+)*)/gi;

/** Section references */
const SECTION_RE =
  /(?:section|sec\.?|u\/s|under\s+section)\s*(\d+(?:\s*[A-Za-z])?(?:\s*(?:&|and|,)\s*\d+(?:\s*[A-Za-z])?)*)(?=\s*(?:of|,|;|\.|$|\n|\r))/gi;

/** Dates in common Indian document formats */
const DATE_RE =
  /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b|\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec),?\s+(\d{4})\b/gi;

/** Compensation / award amounts in INR */
const AMOUNT_RE =
  /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)\s*(?:\/?\-)?(?:\s*(lakh|lac|crore|cr\.?|thousand|lakhs|crores))?/gi;

/** Also match "X lakh/crore" without currency symbol */
const AMOUNT_PLAIN_RE =
  /\b([\d,]+(?:\.\d+)?)\s*(?:lakh|lac|crore|cr\.?)\b/gi;

/** Land area — hectares, acres, sq metres, guntha */
const AREA_RE =
  /\b([\d,]+(?:\.\d+)?)\s*(?:hectares?|ha\.?|acres?|ac\.?|sq(?:uare)?\.?\s*met(?:re|er)s?|sq\.?\s*m\.?|gunthas?)/gi;

/** District — "District of X", "X District", "Dist\. X" */
const DISTRICT_RE =
  /(?:district(?:\s+of)?|dist\.)\s*:?\s*([A-Za-z\s]+?)(?=[,;\n\r\(]|$)|([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+[Dd]istrict/gi;

/** Village / gram panchayat / mouza / revenue village */
const VILLAGE_RE =
  /(?:village|gram\s*panchayat|mouza|revenue\s*village|mauja|gaon)\s*:?\s*([A-Za-z\s]+?)(?=[,;\n\r\(]|$)/gi;

/** Project / scheme reference numbers */
const PROJECT_REF_RE =
  /(?:project\s*(?:ref(?:erence)?\.?|no\.?|code)|scheme\s*no\.?|file\s*no\.?|la\s*case\s*no\.?)\s*:?\s*([A-Z0-9\/\-]+)/gi;

// ── Regex Extraction ──────────────────────────────────────────────────────────

function extractRegex(text: string): NEREntity[] {
  const entities: NEREntity[] = [];

  // ULPINs
  for (const m of text.matchAll(ULPIN_RE)) {
    const raw = m[1].replace(/[\s-]/g, "");
    if (raw.length === 14) {
      entities.push({
        type: "ULPIN",
        value: m[1],
        normalised: raw,
        confidence: 1.0,
        source: "regex",
        charStart: m.index,
        charEnd: (m.index ?? 0) + m[0].length,
      });
    }
  }

  // Survey numbers
  for (const m of text.matchAll(SURVEY_RE)) {
    entities.push({
      type: "SURVEY_NO",
      value: m[1].trim(),
      confidence: 0.95,
      source: "regex",
      charStart: m.index,
      charEnd: (m.index ?? 0) + m[0].length,
    });
  }

  // Section references
  for (const m of text.matchAll(SECTION_RE)) {
    entities.push({
      type: "SECTION_REF",
      value: `Section ${m[1].trim()}`,
      confidence: 0.97,
      source: "regex",
      charStart: m.index,
      charEnd: (m.index ?? 0) + m[0].length,
    });
  }

  // Dates
  for (const m of text.matchAll(DATE_RE)) {
    entities.push({
      type: "NOTIF_DATE",
      value: m[0].trim(),
      confidence: 0.93,
      source: "regex",
      charStart: m.index,
      charEnd: (m.index ?? 0) + m[0].length,
    });
  }

  // Award amounts with currency symbol
  for (const m of text.matchAll(AMOUNT_RE)) {
    const numStr = m[1].replace(/,/g, "");
    let amount = parseFloat(numStr);
    const unit = (m[2] ?? "").toLowerCase();
    if (unit.startsWith("lakh") || unit.startsWith("lac")) amount *= 100_000;
    else if (unit.startsWith("crore") || unit === "cr.") amount *= 10_000_000;

    entities.push({
      type: "AWARD_AMOUNT",
      value: m[0].trim(),
      normalised: amount,
      confidence: 0.92,
      source: "regex",
      charStart: m.index,
      charEnd: (m.index ?? 0) + m[0].length,
    });
  }

  // Award amounts — plain "X lakh/crore"
  for (const m of text.matchAll(AMOUNT_PLAIN_RE)) {
    const numStr = m[1].replace(/,/g, "");
    let amount = parseFloat(numStr);
    const unit = (m[2] ?? m[0].split(/\s+/).pop() ?? "").toLowerCase();
    if (unit.startsWith("lakh") || unit.startsWith("lac")) amount *= 100_000;
    else if (unit.startsWith("crore")) amount *= 10_000_000;

    entities.push({
      type: "AWARD_AMOUNT",
      value: m[0].trim(),
      normalised: amount,
      confidence: 0.85,
      source: "regex",
      charStart: m.index,
      charEnd: (m.index ?? 0) + m[0].length,
    });
  }

  // Areas
  for (const m of text.matchAll(AREA_RE)) {
    const numStr = m[1].replace(/,/g, "");
    let area = parseFloat(numStr);
    const full = m[0].toLowerCase();
    // Convert to hectares
    if (full.includes("acre")) area = area * 0.404686;
    else if (full.includes("sq") && (full.includes("m") || full.includes("met"))) {
      area = area / 10000;
    } else if (full.includes("guntha")) {
      area = area * 0.010117; // 1 guntha ≈ 0.010117 ha
    }

    entities.push({
      type: "AREA_HA",
      value: m[0].trim(),
      normalised: Math.round(area * 10000) / 10000, // 4dp
      confidence: 0.93,
      source: "regex",
      charStart: m.index,
      charEnd: (m.index ?? 0) + m[0].length,
    });
  }

  // Districts
  for (const m of text.matchAll(DISTRICT_RE)) {
    const name = (m[1] ?? m[2] ?? "").trim();
    if (name && name.length > 2) {
      entities.push({
        type: "DISTRICT",
        value: name,
        confidence: 0.88,
        source: "regex",
        charStart: m.index,
        charEnd: (m.index ?? 0) + m[0].length,
      });
    }
  }

  // Villages
  for (const m of text.matchAll(VILLAGE_RE)) {
    const name = m[1].trim();
    if (name && name.length > 2) {
      entities.push({
        type: "VILLAGE",
        value: name,
        confidence: 0.85,
        source: "regex",
        charStart: m.index,
        charEnd: (m.index ?? 0) + m[0].length,
      });
    }
  }

  // Project references
  for (const m of text.matchAll(PROJECT_REF_RE)) {
    entities.push({
      type: "PROJECT_REF",
      value: m[1].trim(),
      confidence: 0.9,
      source: "regex",
      charStart: m.index,
      charEnd: (m.index ?? 0) + m[0].length,
    });
  }

  return entities;
}

// ── HuggingFace BERT-NER ─────────────────────────────────────────────────────

interface HFToken {
  entity_group?: string;
  entity?: string;
  word: string;
  score: number;
  start: number;
  end: number;
}

/** Maps HuggingFace NER label → our EntityType */
const HF_TAG_MAP: Record<string, EntityType> = {
  PER: "OWNER_NAME",
  LOC: "DISTRICT",
  ORG: "PROJECT_REF",
  MISC: "PROJECT_REF",
};

async function extractBERT(text: string): Promise<NEREntity[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) return [];

  try {
    // Truncate to ~512 tokens (≈ 2000 chars for BERT)
    const truncated = text.slice(0, 2000);

    const res = await fetch(
      "https://api-inference.huggingface.co/models/dslim/bert-base-NER",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: truncated,
          options: { wait_for_model: true },
        }),
        signal: AbortSignal.timeout(15000), // 15s timeout
      }
    );

    if (!res.ok) return [];

    const tokens: HFToken[] = await res.json();
    const entities: NEREntity[] = [];

    for (const tok of tokens) {
      const label = tok.entity_group ?? tok.entity ?? "";
      // Strip B- / I- prefixes
      const cleanLabel = label.replace(/^[BI]-/, "");
      const entityType = HF_TAG_MAP[cleanLabel];
      if (!entityType) continue;

      // Filter very short tokens (BERT artefacts)
      const word = tok.word.replace(/^##/, "").trim();
      if (word.length < 2) continue;

      entities.push({
        type: entityType,
        value: word,
        confidence: tok.score,
        source: "bert",
        charStart: tok.start,
        charEnd: tok.end,
      });
    }

    return entities;
  } catch {
    return [];
  }
}

// ── De-duplication and summary ─────────────────────────────────────────────────

function dedup(entities: NEREntity[], type: EntityType): NEREntity[] {
  const seen = new Set<string>();
  return entities.filter((e) => {
    if (e.type !== type) return false;
    const key = e.normalised?.toString() ?? e.value.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSummary(entities: NEREntity[]): ExtractedSummary {
  const get = (type: EntityType) => dedup(entities, type);

  const amounts = get("AWARD_AMOUNT")
    .map((e) => e.normalised as number)
    .filter(Boolean)
    .sort((a, b) => b - a);

  const areas = get("AREA_HA")
    .map((e) => e.normalised as number)
    .filter(Boolean)
    .sort((a, b) => b - a);

  return {
    ulpins: get("ULPIN").map((e) => (e.normalised ?? e.value) as string),
    surveyNumbers: get("SURVEY_NO").map((e) => e.value),
    sectionRefs: get("SECTION_REF").map((e) => e.value),
    dates: get("NOTIF_DATE").map((e) => e.value),
    awardAmountInr: amounts[0] ?? null,
    areaHectares: areas[0] ?? null,
    districts: get("DISTRICT").map((e) => e.value),
    villages: get("VILLAGE").map((e) => e.value),
    ownerNames: get("OWNER_NAME").map((e) => e.value),
    projectRef: get("PROJECT_REF")[0]?.value ?? null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run NER on extracted OCR text.
 * Stage 1: HuggingFace BERT-NER (if HUGGINGFACE_API_KEY is set)
 * Stage 2: Domain-specific regex patterns (always runs)
 * Results are merged and de-duplicated.
 */
export async function runNER(ocrText: string): Promise<NERResult> {
  const regexEntities = extractRegex(ocrText);
  let bertEntities: NEREntity[] = [];
  let bertUsed = false;

  if (process.env.HUGGINGFACE_API_KEY) {
    bertEntities = await extractBERT(ocrText);
    bertUsed = bertEntities.length > 0;
  }

  // Merge: regex results are authoritative for domain-specific types (ULPIN, amounts, etc.)
  // BERT adds OWNER_NAME (PER) which regex can't reliably find
  const merged = [...regexEntities];

  // Add BERT-only types (PER → OWNER_NAME) that regex doesn't cover
  const bertOnlyTypes: EntityType[] = ["OWNER_NAME"];
  for (const e of bertEntities) {
    if (bertOnlyTypes.includes(e.type)) {
      merged.push(e);
    }
  }

  const summary = buildSummary(merged);

  return {
    entities: merged,
    summary,
    bertUsed,
    regexFallback: !bertUsed || regexEntities.length > 0,
  };
}
