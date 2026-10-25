import type { SupabaseClient } from "@supabase/supabase-js";
import { isAnonId } from "./anon-id";
import type { NormalizedSearchInput } from "./normalize-search-input";
import { REPORT_VERSION } from "./constants";
import type { RiskReport } from "./report-schema";
import { riskReportSchema } from "./report-schema";
import { applyRiskBandMaxCapToReport } from "./risk-band-calibration";
import { isMissingAnonIdColumn } from "./usage-event";

export function isReportLegalLookupDegraded(report: RiskReport): boolean {
  const status = report.official.legalLookupStatus;
  return status === "error" || status === "timeout";
}

export function isReportCrLookupDegraded(report: RiskReport): boolean {
  const s = report.official.companiesRegistry?.lookupStatus;
  return s === "error" || s === "timeout";
}

export function isReportLookupDegraded(report: RiskReport): boolean {
  return (
    isReportLegalLookupDegraded(report) || isReportCrLookupDegraded(report)
  );
}

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** When legal lookup degrades, cache report briefly so share links still resolve. */
export const LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS = 10 * 60 * 1000;
export const LOOKUP_DEGRADED_CACHE_TTL_MS = LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS;

export async function getCachedReport(
  supabase: SupabaseClient,
  fingerprint: string,
): Promise<RiskReport | null> {
  const { data } = await supabase
    .from("search_cache")
    .select("report, expires_at")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  const parsed = riskReportSchema.safeParse(data.report);
  if (!parsed.success) return null;
  if (parsed.data.reportVersion !== REPORT_VERSION) return null;

  return applyRiskBandMaxCapToReport(parsed.data);
}

export async function setCachedReport(
  supabase: SupabaseClient,
  fingerprint: string,
  queryInput: NormalizedSearchInput,
  report: RiskReport,
  options?: { ttlMs?: number; skipIfHealthyCacheExists?: boolean },
): Promise<void> {
  if (options?.skipIfHealthyCacheExists && isReportLookupDegraded(report)) {
    const existing = await getCachedReport(supabase, fingerprint);
    if (existing && !isReportLookupDegraded(existing)) {
      return;
    }
  }

  const ttlMs = options?.ttlMs ?? CACHE_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const { error } = await supabase.from("search_cache").upsert({
    fingerprint,
    query_input: queryInput,
    report,
    expires_at: expiresAt,
  });
  if (error) {
    console.warn(`search_cache upsert failed: ${error.message}`);
  }
}

export async function logSearchEvent(
  supabase: SupabaseClient,
  fingerprint: string,
  cacheHit: boolean,
  anonId?: string | null,
): Promise<void> {
  const base = { fingerprint, cache_hit: cacheHit };
  const id = anonId && isAnonId(anonId) ? anonId.toLowerCase() : null;
  const payload = id ? { ...base, anon_id: id } : base;
  try {
    const { error } = await supabase.from("search_events").insert(payload);
    if (!error) return;

    if (id && isMissingAnonIdColumn(error)) {
      const retry = await supabase.from("search_events").insert(base);
      if (!retry.error) return;
      console.warn(
        JSON.stringify({
          event: "search_event_skipped",
          code: retry.error.code ?? "insert_failed",
        }),
      );
      return;
    }

    console.warn(
      JSON.stringify({
        event: "search_event_skipped",
        code: error.code ?? "insert_failed",
      }),
    );
  } catch {
    console.warn(JSON.stringify({ event: "search_event_skipped", code: "insert_threw" }));
  }
}
