import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type OfficialLegalEvent,
  hearingPointsSourceSchema,
  judgmentCategorySchema,
  partyRoleSchema,
  procedureStageSchema,
  type JudgmentCategory,
} from "./legal-event-schema";
import { parseOutcomeHint } from "./outcome-hint";
import {
  legalRowMatchReasonZh,
  legalRowMatchesSearchLabel,
} from "./judgment-lookup-match";
import { soleProprietorDefendantDisplayZh } from "./judgment-sole-prop-import";
import {
  isOfficialLegalEventSourceCatalogAllowed,
  officialLegalEventSourceCatalogAllowlistValues,
} from "./legal-event-catalog-allowlist";
import { isLegalrefJudgmentSourceUrl } from "./legal-event-source-url";
import { normalizeBrDigits } from "./normalize-br";
import { normalizeIsoDatetimeForSchema } from "./normalize-iso-datetime";

export type LegalJudgmentRow = {
  id?: string;
  source_type: string;
  source_catalog_id?: string | null;
  case_ref: string;
  court: string;
  event_date: string;
  party_names?: string[] | null;
  hearing_key_points_zh: string[];
  hearing_key_point_quotes_zh?: string[] | null;
  source_url: string;
  judgment_category: string;
  party_role: string;
  outcome_hint: string | null;
  procedure_stage: string | null;
  company_name_normalized: string;
  br_normalized: string | null;
  lookup_aliases: string[] | null;
  imported_at: string;
  review_status: string | null;
  topic_tags: string[] | null;
  /** Present after migration 20261017101908 is applied. */
  hearing_points_source?: string | null;
};

export type LegalLookupContext = {
  searchLabelUsed: string;
  br?: string;
};

export type LegalLookupResult = {
  events: OfficialLegalEvent[];
  registryAsOf?: string;
};

const MAX_EVENTS = 8;
/** Collect more case-number rows than MAX_EVENTS so dedupe-by-judgment can still fill 8 distinct documents. */
const COLLECT_CAP = MAX_EVENTS * 16;
const FETCH_PAGE_SIZE = 500;

const MATCH_SELECT =
  "id, case_ref, company_name_normalized, lookup_aliases, topic_tags";
const FULL_SELECT =
  "id, source_type, source_catalog_id, case_ref, court, event_date, party_names, hearing_key_points_zh, hearing_key_point_quotes_zh, hearing_points_source, source_url, judgment_category, party_role, outcome_hint, procedure_stage, company_name_normalized, br_normalized, lookup_aliases, imported_at, review_status, topic_tags";

const LOOKUP_CATALOG_IDS = officialLegalEventSourceCatalogAllowlistValues();

function parseEnum<T extends string>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  value: string,
): T | undefined {
  const r = schema.safeParse(value);
  return r.success ? r.data : undefined;
}

function partyNamesArray(row: LegalJudgmentRow): string[] | null {
  const raw = row.party_names;
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw.filter((p) => typeof p === "string" && p.trim());
  }
  return null;
}

function rowToEvent(
  row: LegalJudgmentRow,
  matchReasonZh: string,
): OfficialLegalEvent | null {
  if (
    row.source_catalog_id &&
    !isOfficialLegalEventSourceCatalogAllowed(row.source_catalog_id)
  ) {
    return null;
  }
  if (!isLegalrefJudgmentSourceUrl(row.source_url)) return null;

  const judgmentCategory = parseEnum(judgmentCategorySchema, row.judgment_category);
  const partyRole = parseEnum(partyRoleSchema, row.party_role);
  if (!judgmentCategory || !partyRole) return null;
  if (judgmentCategory === "employment_labour") return null;

  const points = Array.isArray(row.hearing_key_points_zh)
    ? row.hearing_key_points_zh.filter((p) => typeof p === "string" && p.trim())
    : [];
  if (points.length === 0) return null;

  const quotesRaw = row.hearing_key_point_quotes_zh;
  const quotes = Array.isArray(quotesRaw) ? (quotesRaw as string[]) : [];
  const hearingKeyPointQuotesZh = points
    .slice(0, 8)
    .map((_, i) => (typeof quotes[i] === "string" ? quotes[i]! : ""));

  const eventDate =
    typeof row.event_date === "string"
      ? row.event_date.slice(0, 10)
      : String(row.event_date).slice(0, 10);

  const reviewStatus =
    row.review_status === "human_verified" ? "human_verified" : "auto";

  const parties = partyNamesArray(row);
  const soleDisplay = soleProprietorDefendantDisplayZh(parties);

  const neutral = row.topic_tags
    ?.find((t) => t.startsWith("neutral_citation:"))
    ?.slice("neutral_citation:".length)
    .trim()
    .slice(0, 40);

  return {
    sourceType: "court_judgment",
    caseRef: row.case_ref,
    court: row.court,
    eventDate,
    judgmentCategory,
    partyRole,
    ...(row.outcome_hint
      ? (() => {
          const v = parseOutcomeHint(row.outcome_hint);
          return v ? { outcomeHint: v } : {};
        })()
      : {}),
    ...(row.procedure_stage
      ? (() => {
          const v = parseEnum(procedureStageSchema, row.procedure_stage);
          return v ? { procedureStage: v } : {};
        })()
      : {}),
    hearingKeyPointsZh: points.slice(0, 8),
    hearingKeyPointQuotesZh,
    ...(row.hearing_points_source
      ? (() => {
          const v = parseEnum(
            hearingPointsSourceSchema,
            row.hearing_points_source,
          );
          return v ? { hearingPointsSource: v } : {};
        })()
      : {}),
    sourceUrl: row.source_url,
    matchReasonZh,
    sourceLabel: "司法機構刊憲",
    reviewStatus,
    ...(row.topic_tags?.includes("sole_proprietorship") && soleDisplay
      ? {
          businessForm: "sole_proprietorship" as const,
          defendantDisplayNameZh: soleDisplay,
        }
      : {}),
    ...(neutral ? { neutralCitation: neutral } : {}),
  };
}

export function judgmentDedupeKey(ev: OfficialLegalEvent): string {
  if (ev.neutralCitation) {
    return `nc:${ev.neutralCitation.replace(/\s+/g, " ").toUpperCase()}`;
  }
  const dis = ev.sourceUrl.match(/DIS=(\d+)/i)?.[1];
  if (dis) return `dis:${dis}`;
  return `ref:${ev.caseRef}`;
}

export function dedupeByJudgment(
  events: OfficialLegalEvent[],
): OfficialLegalEvent[] {
  const byKey = new Map<string, OfficialLegalEvent[]>();
  for (const ev of events) {
    const k = judgmentDedupeKey(ev);
    const list = byKey.get(k) ?? [];
    list.push(ev);
    byKey.set(k, list);
  }
  const merged: OfficialLegalEvent[] = [];
  for (const group of byKey.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        b.eventDate.localeCompare(a.eventDate) ||
        a.caseRef.localeCompare(b.caseRef),
    );
    const primary = sorted[0]!;
    const related = [
      ...new Set(
        sorted
          .slice(1)
          .map((e) => e.caseRef)
          .filter((r) => r !== primary.caseRef),
      ),
    ].sort((a, b) => a.localeCompare(b, "zh-HK"));
    merged.push({
      ...primary,
      ...(related.length ? { relatedCaseRefs: related } : {}),
    });
  }
  return merged.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
}

function shouldSkipLegalRow(row: LegalJudgmentRow): boolean {
  return row.judgment_category === "employment_labour";
}

function strongestCategory(events: OfficialLegalEvent[]): JudgmentCategory | undefined {
  const priority: JudgmentCategory[] = [
    "renovation_engineering_civil",
    "building_defect_water_damage",
    "arbitration_award",
    "small_claims_debt",
    "general_contract_debt",
    "criminal_regulatory",
    "winding_up_insolvency",
    "personal_injury_site",
    "small_works_regulatory",
    "employment_renovation",
    "employment_labour",
    "other_civil",
    "landlord_tenant",
    "intellectual_property",
    "defamation",
    "unknown",
  ];
  const set = new Set(events.map((e) => e.judgmentCategory));
  for (const cat of priority) {
    if (set.has(cat)) return cat;
  }
  return undefined;
}

export { strongestCategory };

type LegalMatchRow = Pick<
  LegalJudgmentRow,
  "id" | "case_ref" | "company_name_normalized" | "lookup_aliases" | "topic_tags"
>;

async function fetchMatchRows(
  supabase: SupabaseClient,
): Promise<LegalMatchRow[]> {
  let from = 0;
  const out: LegalMatchRow[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("official_legal_events")
      .select(MATCH_SELECT)
      .in("source_catalog_id", LOOKUP_CATALOG_IDS)
      .eq("renovation_relevant", true)
      .order("event_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as LegalMatchRow[];
    out.push(...batch);
    if (batch.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }
  return out;
}

async function fetchRowsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<LegalJudgmentRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("official_legal_events")
    .select(FULL_SELECT)
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as LegalJudgmentRow[];
}

export async function lookupLegalJudgments(
  supabase: SupabaseClient,
  ctx: LegalLookupContext,
): Promise<LegalLookupResult> {
  const { data: metaRows, error: metaError } = await supabase
    .from("official_legal_events")
    .select("imported_at")
    .in("source_catalog_id", LOOKUP_CATALOG_IDS)
    .eq("renovation_relevant", true)
    .order("imported_at", { ascending: false })
    .limit(1);

  if (metaError) throw metaError;

  const registryAsOf = normalizeIsoDatetimeForSchema(
    metaRows?.[0]?.imported_at as string | undefined,
  );

  const br = normalizeBrDigits(ctx.br);
  const matched: OfficialLegalEvent[] = [];
  const seenCase = new Set<string>();
  const matchedIds: string[] = [];

  if (br) {
    const { data, error: brError } = await supabase
      .from("official_legal_events")
      .select(FULL_SELECT)
      .in("source_catalog_id", LOOKUP_CATALOG_IDS)
      .eq("br_normalized", br)
      .eq("renovation_relevant", true)
      .order("event_date", { ascending: false })
      .limit(COLLECT_CAP);

    if (brError) throw brError;

    for (const row of data ?? []) {
      const r = row as LegalJudgmentRow;
      if (seenCase.has(r.case_ref)) continue;
      if (shouldSkipLegalRow(r)) continue;
      const ev = rowToEvent(r, "商業登記號碼與匯入紀錄一致");
      if (!ev) continue;
      seenCase.add(r.case_ref);
      matched.push(ev);
      if (r.id) matchedIds.push(r.id);
      if (matched.length >= COLLECT_CAP) break;
    }
  }

  // Spec B2: merge related case numbers first, then slice to MAX_EVENTS distinct judgments.
  if (dedupeByJudgment(matched).length < MAX_EVENTS) {
    const label = ctx.searchLabelUsed.trim();
    const slimRows = await fetchMatchRows(supabase);
    const hitIds: string[] = [];

    for (const r of slimRows) {
      if (seenCase.has(r.case_ref)) continue;
      if (!legalRowMatchesSearchLabel(label, r)) continue;
      if (!r.id) continue;
      hitIds.push(r.id);
      seenCase.add(r.case_ref);
      if (matched.length + hitIds.length >= COLLECT_CAP) break;
    }

    const fullRows = await fetchRowsByIds(supabase, hitIds);
    const byId = new Map(fullRows.map((r) => [r.id!, r]));
    for (const id of hitIds) {
      const r = byId.get(id);
      if (!r || shouldSkipLegalRow(r)) continue;
      const ev = rowToEvent(r, legalRowMatchReasonZh(label, r));
      if (!ev) continue;
      matched.push(ev);
      if (matched.length >= COLLECT_CAP) break;
    }
  }

  const deduped = dedupeByJudgment(matched);
  return {
    events: deduped.slice(0, MAX_EVENTS),
    registryAsOf,
  };
}
