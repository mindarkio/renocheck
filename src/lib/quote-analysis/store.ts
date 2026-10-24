import "server-only";

import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { QUOTE_MODEL_ID } from "@/lib/quote-analysis/config";
import type { StoredQuoteItem } from "@/lib/quote-analysis/schema";

export type QuoteBeginResult =
  | { ok: true; claimId: string }
  | { ok: false; reason: "quota" | "budget" | "unavailable" };

export type QuoteFinishInput = {
  claimId: string;
  outcome: "succeeded" | "failed" | "released";
  actualMicroUsd: number | null;
  pageCount: number;
  items: StoredQuoteItem[] | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type QuoteStore = {
  begin(input: {
    userId: string;
    reserveMicroUsd: number;
    dailyLimit: number;
    capMicroUsd: number;
    freeCapMicroUsd: number;
    callCap: number;
  }): Promise<QuoteBeginResult>;
  finish(input: QuoteFinishInput): Promise<{ analysisId: string | null }>;
};

function quoteDbAllowed(): boolean {
  try {
    assertNotProdDbOutsideProd();
    return true;
  } catch {
    return false;
  }
}

export const supabaseQuoteStore: QuoteStore = {
  async begin(input) {
    if (!quoteDbAllowed()) return { ok: false, reason: "unavailable" };
    const admin = getSupabaseAdmin();
    if (!admin) return { ok: false, reason: "unavailable" };
    const { data, error } = await admin.rpc("begin_quote_analysis", {
      p_user_id: input.userId,
      p_reserve: input.reserveMicroUsd,
      p_daily_limit: input.dailyLimit,
      p_cap_micro: input.capMicroUsd,
      p_free_cap_micro: input.freeCapMicroUsd,
      p_call_cap: input.callCap,
    });
    if (error || !data || typeof data !== "object") {
      return { ok: false, reason: "unavailable" };
    }
    const row = data as { ok?: boolean; reason?: string; claim_id?: string };
    if (row.ok === true && typeof row.claim_id === "string") {
      return { ok: true, claimId: row.claim_id };
    }
    if (row.reason === "quota" || row.reason === "budget") {
      return { ok: false, reason: row.reason };
    }
    return { ok: false, reason: "unavailable" };
  },

  async finish(input) {
    if (!quoteDbAllowed()) return { analysisId: null };
    const admin = getSupabaseAdmin();
    if (!admin) return { analysisId: null };
    const { data, error } = await admin.rpc("finish_quote_analysis", {
      p_claim_id: input.claimId,
      p_outcome: input.outcome,
      p_actual_micro: input.actualMicroUsd,
      p_page_count: input.pageCount,
      p_items: input.items,
      p_input_tokens: input.inputTokens,
      p_output_tokens: input.outputTokens,
      p_model_id: QUOTE_MODEL_ID,
    });
    if (error) return { analysisId: null };
    return { analysisId: typeof data === "string" ? data : null };
  },
};
