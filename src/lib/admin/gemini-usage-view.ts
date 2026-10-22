import "server-only";
import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import {
  getGeminiUsageSnapshot,
  nextPacificReset,
  pacificDayStart,
  type GeminiUsageSnapshot,
} from "@/lib/gemini-usage";
import { llmProviderKind, llmProviderLabel } from "@/lib/llm-model";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type GeminiUsageCardData = {
  providerLabel: string | null;
  providerKind: "google" | "gateway" | null;
  usedToday: number;
  rpdLimit: number | null;
  rpmLimit: number | null;
  http429: number;
  quotaDay: number;
  rateMinute: number;
  server5xx: number;
  last429At: string | null;
  lastQuotaValue: number | null;
  nextReset: string;
  warning: boolean;
};

export type GeminiUsageCardResult =
  | { ok: true; data: GeminiUsageCardData }
  | { ok: false };

/** Positive integers only. Unset, zero, and non-integers are null (UI shows 未設定). */
export function readGeminiLimitEnv(name: string): number | null {
  const raw = process.env[name]?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

export function buildGeminiUsageCard(args: {
  now: Date;
  snapshot: GeminiUsageSnapshot;
  searchEventsUncachedToday: number | null;
  providerLabel: string | null;
  providerKind: "google" | "gateway" | null;
  rpdLimit: number | null;
  rpmLimit: number | null;
}): GeminiUsageCardData {
  const { snapshot } = args;
  const usedToday =
    args.searchEventsUncachedToday == null
      ? snapshot.instanceCalls
      : Math.max(args.searchEventsUncachedToday, snapshot.instanceCalls);
  const { counts24h } = snapshot;
  return {
    providerLabel: args.providerLabel,
    providerKind: args.providerKind,
    usedToday,
    rpdLimit: args.rpdLimit,
    rpmLimit: args.rpmLimit,
    http429: counts24h.quota_day + counts24h.rate_minute + counts24h.rate_other,
    quotaDay: counts24h.quota_day,
    rateMinute: counts24h.rate_minute,
    server5xx: counts24h.server_5xx,
    last429At:
      snapshot.last429At == null
        ? null
        : new Date(snapshot.last429At).toISOString(),
    lastQuotaValue: snapshot.lastQuotaValue,
    nextReset: nextPacificReset(args.now).toISOString(),
    warning: counts24h.quota_day > 0 || counts24h.rate_minute >= 3,
  };
}

/**
 * Uncached successful searches since Pacific midnight. Null when the read
 * failed or Supabase is not configured — never a stand-in 0.
 * The overflow fixture skips the database entirely.
 */
export async function countUncachedSearchEventsSincePacificMidnight(
  now: Date,
): Promise<number | null> {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.OVERFLOW_CHECK_GEMINI === "1"
  ) {
    return null;
  }

  try {
    assertNotProdDbOutsideProd();
  } catch {
    console.warn(
      JSON.stringify({
        event: "admin_gemini_usage_error",
        code: "refusing_prod_db",
      }),
    );
    return null;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const start = pacificDayStart(now).toISOString();
  const { count, error } = await supabase
    .from("search_events")
    .select("id", { count: "exact", head: true })
    .eq("cache_hit", false)
    .gte("created_at", start);

  if (error || count == null) {
    console.warn(
      JSON.stringify({
        event: "admin_gemini_usage_error",
        code: error?.code ?? "query_failed",
      }),
    );
    return null;
  }
  return count;
}

export async function fetchGeminiUsageCard(
  now = new Date(),
): Promise<GeminiUsageCardResult> {
  try {
    const snapshot = getGeminiUsageSnapshot(now.getTime());
    const searchEventsUncachedToday =
      await countUncachedSearchEventsSincePacificMidnight(now);
    return {
      ok: true,
      data: buildGeminiUsageCard({
        now,
        snapshot,
        searchEventsUncachedToday,
        providerLabel: llmProviderLabel(),
        providerKind: llmProviderKind(),
        rpdLimit: readGeminiLimitEnv("GEMINI_RPD_LIMIT"),
        rpmLimit: readGeminiLimitEnv("GEMINI_RPM_LIMIT"),
      }),
    };
  } catch {
    console.warn(
      JSON.stringify({ event: "admin_gemini_usage_error", code: "unexpected" }),
    );
    return { ok: false };
  }
}
