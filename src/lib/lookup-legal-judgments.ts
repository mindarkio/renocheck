import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type OfficialLegalEvent,
  judgmentCategorySchema,
  outcomeHintSchema,
  partyRoleSchema,
  procedureStageSchema,
  type JudgmentCategory,
} from "./legal-event-schema";
import { legalRowMatchesSearchLabel } from "./judgment-lookup-match";
import { normalizeBrDigits } from "./normalize-br";
import { normalizeIsoDatetimeForSchema } from "./normalize-iso-datetime";

export type LegalJudgmentRow = {
  source_type: string;
  case_ref: string;
  court: string;
  event_date: string;
  hearing_key_points_zh: string[];
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

function parseEnum<T extends string>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  value: string,
): T | undefined {
  const r = schema.safeParse(value);
  return r.success ? r.data : undefined;
}

function rowToEvent(
  row: LegalJudgmentRow,
  matchReasonZh: string,
): OfficialLegalEvent | null {
  const judgmentCategory = parseEnum(judgmentCategorySchema, row.judgment_category);
  const partyRole = parseEnum(partyRoleSchema, row.party_role);
  if (!judgmentCategory || !partyRole) return null;

  const points = Array.isArray(row.hearing_key_points_zh)
    ? row.hearing_key_points_zh.filter((p) => typeof p === "string" && p.trim())
    : [];
  if (points.length === 0) return null;

  const eventDate =
    typeof row.event_date === "string"
      ? row.event_date.slice(0, 10)
      : String(row.event_date).slice(0, 10);

  const reviewStatus =
    row.review_status === "human_verified" ? "human_verified" : "auto";

  return {
    sourceType: "court_judgment",
    caseRef: row.case_ref,
    court: row.court,
    eventDate,
    judgmentCategory,
    partyRole,
    ...(row.outcome_hint
      ? (() => {
          const v = parseEnum(outcomeHintSchema, row.outcome_hint);
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
    sourceUrl: row.source_url,
    matchReasonZh,
    sourceLabel: "司法機構刊憲",
    reviewStatus,
  };
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

export async function lookupLegalJudgments(
  supabase: SupabaseClient,
  ctx: LegalLookupContext,
): Promise<LegalLookupResult> {
  const selectCols =
    "source_type, case_ref, court, event_date, hearing_key_points_zh, source_url, judgment_category, party_role, outcome_hint, procedure_stage, company_name_normalized, br_normalized, lookup_aliases, imported_at, review_status";

  const { data: metaRows } = await supabase
    .from("official_legal_events")
    .select("imported_at")
    .order("imported_at", { ascending: false })
    .limit(1);

  const registryAsOf = normalizeIsoDatetimeForSchema(
    metaRows?.[0]?.imported_at as string | undefined,
  );

  const br = normalizeBrDigits(ctx.br);
  const matched: OfficialLegalEvent[] = [];
  const seenCase = new Set<string>();

  if (br) {
    const { data } = await supabase
      .from("official_legal_events")
      .select(selectCols)
      .eq("br_normalized", br)
      .eq("renovation_relevant", true)
      .order("event_date", { ascending: false })
      .limit(MAX_EVENTS + 2);

    for (const row of data ?? []) {
      const r = row as LegalJudgmentRow;
      if (seenCase.has(r.case_ref)) continue;
      const ev = rowToEvent(r, "商業登記號碼與匯入紀錄一致");
      if (!ev) continue;
      seenCase.add(r.case_ref);
      matched.push(ev);
      if (matched.length >= MAX_EVENTS) break;
    }
  }

  if (matched.length < MAX_EVENTS) {
    const label = ctx.searchLabelUsed.trim();
    const { data } = await supabase
      .from("official_legal_events")
      .select(selectCols)
      .eq("renovation_relevant", true)
      .order("event_date", { ascending: false })
      .limit(80);

    for (const row of data ?? []) {
      const r = row as LegalJudgmentRow;
      if (seenCase.has(r.case_ref)) continue;
      if (!legalRowMatchesSearchLabel(label, r)) continue;
      const ev = rowToEvent(r, "公司名稱與匯入紀錄一致");
      if (!ev) continue;
      seenCase.add(r.case_ref);
      matched.push(ev);
      if (matched.length >= MAX_EVENTS) break;
    }
  }

  return {
    events: matched.slice(0, MAX_EVENTS),
    registryAsOf,
  };
}
