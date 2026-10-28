import "server-only";

import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { takeAuthRateLimit, rateLimitIp } from "@/lib/auth/rate-limit";
import {
  QUOTE_MODEL_ID,
  quoteAnonDailyLimit,
  quoteDailyBudgetMicroUsd,
  quoteDailyCallCap,
  quoteFreeDailyBudgetMicroUsd,
  spendDecision,
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

async function spendRow() {
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return { kind: "unavailable" as const };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { kind: "unavailable" as const };
  const day = hktDayKey();
  const { data, error } = await admin
    .from("quote_spend_daily")
    .select("spent_micro_usd, reserved_micro_usd, calls")
    .eq("day_hkt", day)
    .maybeSingle();
  if (error) return { kind: "unavailable" as const };
  const spent = Number(data?.spent_micro_usd ?? 0);
  const reserved = Number(data?.reserved_micro_usd ?? 0);
  const calls = Number(data?.calls ?? 0);
  if (![spent, reserved, calls].every((n) => Number.isFinite(n))) {
    return { kind: "unavailable" as const };
  }
  return {
    kind: "row" as const,
    day,
    spent,
    reserved,
    calls,
    admin,
  };
}

/** Fresh read. Not the homepage cache. Fail closed when the row cannot be read. */
export async function anonymousBudgetAllows(
  reserveMicroUsd: number,
  env: Record<string, string | undefined> = process.env,
): Promise<"ok" | "budget" | "unavailable"> {
  const row = await spendRow();
  if (row.kind === "unavailable") return "unavailable";
  const decision = spendDecision({
    used: 0,
    limit: 1,
    spent: row.spent,
    reserved: row.reserved,
    reserve: reserveMicroUsd,
    cap: quoteDailyBudgetMicroUsd(env),
    freeCap: quoteFreeDailyBudgetMicroUsd(env),
    calls: row.calls,
    callCap: quoteDailyCallCap(env),
  });
  return decision === "budget" ? "budget" : "ok";
}

/** Best-effort booking after Azure has already run. Does not log amounts tied to a result. */
export async function noteAnonymousSpend(microUsd: number): Promise<void> {
  const row = await spendRow();
  if (row.kind === "unavailable") return;
  const add = Number.isFinite(microUsd) && microUsd > 0 ? Math.ceil(microUsd) : 0;
  await row.admin.from("quote_spend_daily").upsert(
    {
      day_hkt: row.day,
      spent_micro_usd: row.spent + add,
      reserved_micro_usd: row.reserved,
      calls: row.calls + 1,
    },
    { onConflict: "day_hkt" },
  );
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
