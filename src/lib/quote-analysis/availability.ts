import "server-only";

import {
  QUOTE_FREE_ANALYSES_PER_DAY,
  isQuoteAnalysisAvailable,
  quoteDailyBudgetMicroUsd,
  quoteDailyCallCap,
  quoteFreeDailyBudgetMicroUsd,
  reserveMicroUsd,
  spendDecision,
} from "@/lib/quote-analysis/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export function hktDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * True when a 1-page analysis would be refused for the shared daily cap.
 * A missing row is not full. Per-account quota is not this check.
 */
export function quoteBudgetIsFull(
  row: { spent: number; reserved: number; calls: number } | null,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!row) return false;
  return (
    spendDecision({
      used: 0,
      limit: QUOTE_FREE_ANALYSES_PER_DAY,
      spent: row.spent,
      reserved: row.reserved,
      reserve: reserveMicroUsd(1),
      cap: quoteDailyBudgetMicroUsd(env),
      freeCap: quoteFreeDailyBudgetMicroUsd(env),
      calls: row.calls,
      callCap: quoteDailyCallCap(env),
    }) === "budget"
  );
}

const BUDGET_CACHE_MS = 45_000;

let budgetCache: { at: number; open: boolean } | null = null;

export function resetQuoteAvailabilityCacheForTests(): void {
  budgetCache = null;
}

async function readBudgetOpen(
  env: Record<string, string | undefined>,
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return true;
  try {
    const { data, error } = await admin
      .from("quote_spend_daily")
      .select("spent_micro_usd, reserved_micro_usd, calls")
      .eq("day_hkt", hktDayKey())
      .maybeSingle();
    if (error || !data) return true;
    const spent = Number(data.spent_micro_usd);
    const reserved = Number(data.reserved_micro_usd);
    const calls = Number(data.calls);
    if (![spent, reserved, calls].every((n) => Number.isFinite(n))) return true;
    return !quoteBudgetIsFull({ spent, reserved, calls }, env);
  } catch {
    return true;
  }
}

/**
 * Flag, Azure config, and the shared daily budget.
 * The spend read is cached for 45s because the header calls this on every page.
 * If the spend row cannot be read, stay open when the feature is configured.
 * The analyse route still enforces the cap on a fresh read.
 */
export async function isQuoteUploadOpen(
  env: Record<string, string | undefined> = process.env,
  now = Date.now(),
): Promise<boolean> {
  if (!isQuoteAnalysisAvailable(env)) return false;
  if (budgetCache && now - budgetCache.at < BUDGET_CACHE_MS) return budgetCache.open;
  const open = await readBudgetOpen(env);
  budgetCache = { at: now, open };
  return open;
}
