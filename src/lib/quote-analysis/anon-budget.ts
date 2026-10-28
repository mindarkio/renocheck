import "server-only";

import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { takeAuthRateLimit, rateLimitIp } from "@/lib/auth/rate-limit";
import {
  QUOTE_MODEL_ID,
  quoteAnonDailyLimit,
  quoteDailyBudgetMicroUsd,
  quoteDailyCallCap,
  quoteFreeDailyBudgetMicroUsd,
} from "@/lib/quote-analysis/config";
import { hktDayKey } from "@/lib/quote-analysis/availability";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const DAY_SECONDS = 86_400;

/** Seconds until the next Hong Kong midnight, capped at the RPC's 24h maximum. */
export function secondsUntilNextHktMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const num = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const elapsed = num("hour") * 3600 + num("minute") * 60 + num("second");
  return Math.min(DAY_SECONDS, Math.max(1, DAY_SECONDS - elapsed));
}

export async function takeAnonymousQuoteSlot(
  ip: string,
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
): Promise<"ok" | "limited" | "unavailable"> {
  const limit = quoteAnonDailyLimit(env);
  if (limit <= 0) return "limited";
  return takeAuthRateLimit({
    key: `quote-anon:${hktDayKey(now)}:${rateLimitIp(ip)}`,
    limit,
    windowMs: secondsUntilNextHktMidnight(now) * 1000,
  });
}

export type AnonymousSpendHold = { day: string; reserve: number };

/**
 * Atomic hold on the locked HKT day row, same caps as begin_quote_analysis.
 * Fails closed when the database or guard is unavailable.
 */
export async function reserveAnonymousQuoteSpend(
  reserveMicroUsd: number,
  env: Record<string, string | undefined> = process.env,
): Promise<AnonymousSpendHold | "budget" | "unavailable"> {
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return "unavailable";
  }
  const admin = getSupabaseAdmin();
  if (!admin) return "unavailable";
  const reserve = Math.ceil(reserveMicroUsd);
  const { data, error } = await admin.rpc("reserve_anonymous_quote_spend", {
    p_reserve: reserve,
    p_cap_micro: quoteDailyBudgetMicroUsd(env),
    p_free_cap_micro: quoteFreeDailyBudgetMicroUsd(env),
    p_call_cap: quoteDailyCallCap(env),
  });
  if (error) return "unavailable";
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return "budget";
  return { day: data, reserve };
}

/** Moves the hold to spent. Null books the full hold. Call once after Azure ran or threw. */
export async function settleAnonymousQuoteSpend(
  hold: AnonymousSpendHold,
  actualMicroUsd: number | null,
): Promise<void> {
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return;
  }
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const actual =
    actualMicroUsd != null && Number.isFinite(actualMicroUsd) && actualMicroUsd >= 0
      ? Math.ceil(actualMicroUsd)
      : null;
  await admin.rpc("settle_anonymous_quote_spend", {
    p_day: hold.day,
    p_reserve: hold.reserve,
    p_actual: actual,
  });
}

export async function countUserQuoteUsesToday(userId: string): Promise<number | null> {
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return null;
  }
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const day = hktDayKey();
  const analyses = await admin
    .from("quote_analyses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("day_hkt", day);
  const claims = await admin
    .from("quote_analysis_claims")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("day_hkt", day)
    .eq("status", "claimed");
  if (analyses.error || claims.error) return null;
  return (analyses.count ?? 0) + (claims.count ?? 0);
}

export async function insertQuoteChecklist(input: {
  userId: string;
  pageCount: number;
  items: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  actualMicroUsd: number | null;
}): Promise<string | null> {
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return null;
  }
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("quote_analyses")
    .insert({
      user_id: input.userId,
      day_hkt: hktDayKey(),
      page_count: input.pageCount,
      items: input.items,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      est_cost_micro_usd: input.actualMicroUsd,
      model_id: QUOTE_MODEL_ID,
    })
    .select("id")
    .single();
  if (error || !data || typeof data.id !== "string") return null;
  return data.id;
}
