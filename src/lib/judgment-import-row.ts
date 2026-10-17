import { createHash } from "node:crypto";
import { assertLegalrefJudgmentSourceUrl } from "./legal-event-source-url";
import { resolveImportCompanyFields } from "./judgment-sole-prop-import";
import {
  HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH,
  isHearingSummaryPlaceholder,
} from "./judgment-hearing-summary";
import { brNormalizedFromSeedField } from "./normalize-br";
import type { HearingPointsSource } from "./legal-event-schema";

export function judgmentImportRowKey(
  sourceCatalogId: string,
  caseRef: string,
): string {
  const ref = caseRef.replace(/\s+/g, "").toUpperCase();
  return `${sourceCatalogId}|${ref}`;
}

export type JudgmentSeedRow = {
  sourceType?: string;
  sourceCatalogId: string;
  caseRef: string;
  court: string;
  eventDate: string;
  partyNames?: string[];
  brNormalized?: string;
  companyNameNormalized: string;
  judgmentCategory: string;
  partyRole: string;
  outcomeHint?: string;
  procedureStage?: string;
  hearingKeyPointsZh: string[];
  sourceUrl: string;
  sourcePublishedAt?: string;
  renovationRelevant?: boolean;
  topicTags?: string[];
  lookupAliases?: string[];
  reviewStatus?: "auto" | "human_verified";
  /** Only explicit `manual` sets DB hearing_points_source to manual on insert. */
  hearingPointsSource?: HearingPointsSource;
};

export type ExistingJudgmentHearingRow = {
  hearing_key_points_zh: unknown;
  hearing_key_point_quotes_zh?: unknown;
  hearing_points_source: string | null;
  outcome_hint?: string | null;
  review_status?: string | null;
};

const PRESERVED_HEARING_SOURCES = new Set(["ai_verified", "manual"]);

export function judgmentSeedContentHash(row: JudgmentSeedRow): string {
  const payload = JSON.stringify({
    caseRef: row.caseRef,
    sourceUrl: row.sourceUrl,
    eventDate: row.eventDate,
    companyNameNormalized: row.companyNameNormalized,
    judgmentCategory: row.judgmentCategory,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function hearingPointsAllPlaceholder(points: string[]): boolean {
  return points.length === 0 || points.every((p) => isHearingSummaryPlaceholder(p));
}

export function buildJudgmentImportDbRow(
  row: JudgmentSeedRow,
  existing?: ExistingJudgmentHearingRow | null,
) {
  const shaped = resolveImportCompanyFields({
    companyNameNormalized: row.companyNameNormalized,
    partyNames: row.partyNames,
    lookupAliases: row.lookupAliases,
    topicTags: row.topicTags,
  });
  const br = brNormalizedFromSeedField(row.brNormalized);
  const source_url = assertLegalrefJudgmentSourceUrl(row.sourceUrl);
  const seedPoints = row.hearingKeyPointsZh ?? [];

  const base = {
    source_type: row.sourceType ?? "court_judgment",
    source_catalog_id: row.sourceCatalogId,
    case_ref: row.caseRef,
    court: row.court,
    event_date: row.eventDate,
    party_names: row.partyNames ?? [row.companyNameNormalized],
    source_url,
    source_published_at: row.sourcePublishedAt ?? null,
    br_normalized: br ?? null,
    company_name_normalized: shaped.companyNameNormalized,
    lookup_aliases: shaped.lookupAliases,
    judgment_category: row.judgmentCategory,
    party_role: row.partyRole,
    procedure_stage: row.procedureStage ?? null,
    renovation_relevant: row.renovationRelevant ?? true,
    topic_tags: shaped.topicTags,
    source_content_hash: judgmentSeedContentHash(row),
  };

  if (
    existing?.hearing_points_source &&
    PRESERVED_HEARING_SOURCES.has(existing.hearing_points_source)
  ) {
    return {
      ...base,
      hearing_key_points_zh: existing.hearing_key_points_zh,
      hearing_key_point_quotes_zh: existing.hearing_key_point_quotes_zh ?? [],
      hearing_points_source: existing.hearing_points_source,
      outcome_hint: existing.outcome_hint ?? row.outcomeHint ?? null,
      review_status: existing.review_status ?? row.reviewStatus ?? "auto",
    };
  }

  const placeholder = hearingPointsAllPlaceholder(seedPoints);
  const hearing_points_source: HearingPointsSource =
    row.hearingPointsSource === "manual"
      ? "manual"
      : placeholder
        ? "placeholder"
        : "placeholder";

  return {
    ...base,
    hearing_key_points_zh: placeholder
      ? [HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH]
      : seedPoints,
    hearing_key_point_quotes_zh: [],
    hearing_points_source,
    outcome_hint: row.outcomeHint ?? null,
    review_status: row.reviewStatus ?? "auto",
  };
}
