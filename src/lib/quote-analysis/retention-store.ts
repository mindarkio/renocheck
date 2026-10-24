import "server-only";

import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type DbError = { code?: string; message?: string } | null;

/** The migration that adds the function has not been applied yet. */
export function isMissingQuoteRetentionFunction(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  // 42883 is also raised for an undefined function *inside* the body; only the
  // purge function itself being absent counts as "not migrated yet". Any other
  // error that merely names the function (e.g. 42501 permission denied) is a failure.
  return (
    error.code === "42883" &&
    /function public\.purge_quote_analysis_retention\(\) does not exist/i.test(error.message ?? "")
  );
}

export type QuoteRetentionPurgeResult =
  | {
      ok: true;
      analysesDeleted: number;
      claimsDeleted: number;
      spendRowsDeleted: number;
      pending: boolean;
    }
  | { ok: false; code: "refusing_prod_db" | "db_unconfigured" | "purge_failed" };

function count(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Calls public.purge_quote_analysis_retention() with the service role.
 * Deletes analyses, claims, and their metadata older than 180 days, and
 * spend rows older than 30 Hong Kong days. Idempotent.
 */
export async function purgeQuoteAnalysisRetention(): Promise<QuoteRetentionPurgeResult> {
  try {
    assertNotProdDbOutsideProd();
  } catch (error) {
    if (error instanceof Error && error.message === "refusing_prod_db") {
      return { ok: false, code: "refusing_prod_db" };
    }
    throw error;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, code: "db_unconfigured" };

  const { data, error } = await supabase.rpc("purge_quote_analysis_retention");
  if (error) {
    if (isMissingQuoteRetentionFunction(error)) {
      return {
        ok: true,
        analysesDeleted: 0,
        claimsDeleted: 0,
        spendRowsDeleted: 0,
        pending: true,
      };
    }
    return { ok: false, code: "purge_failed" };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        analyses_deleted?: unknown;
        claims_deleted?: unknown;
        spend_rows_deleted?: unknown;
      }
    | null
    | undefined;
  return {
    ok: true,
    analysesDeleted: count(row?.analyses_deleted),
    claimsDeleted: count(row?.claims_deleted),
    spendRowsDeleted: count(row?.spend_rows_deleted),
    pending: false,
  };
}
