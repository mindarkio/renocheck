import "server-only";

import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type DbError = { code?: string; message?: string } | null;

/** The migration that adds the function has not been applied yet. */
export function isMissingAnonIdPurgeFunction(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  // 42883 is also raised for an undefined function inside the body. Only this
  // function being absent counts as not migrated yet.
  return (
    error.code === "42883" &&
    /function public\.purge_returning_user_anon_ids\(\) does not exist/i.test(error.message ?? "")
  );
}

export type AnonIdPurgeResult =
  | { ok: true; searchCleared: number; usageCleared: number; pending: boolean }
  | { ok: false; code: "refusing_prod_db" | "db_unconfigured" | "purge_failed" };

function count(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Calls public.purge_returning_user_anon_ids() with the service role.
 * Idempotent: it only nulls anon_id that is still set on rows older than 90 days.
 */
export async function purgeReturningUserAnonIds(): Promise<AnonIdPurgeResult> {
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

  const { data, error } = await supabase.rpc("purge_returning_user_anon_ids");
  if (error) {
    if (isMissingAnonIdPurgeFunction(error)) {
      return { ok: true, searchCleared: 0, usageCleared: 0, pending: true };
    }
    return { ok: false, code: "purge_failed" };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { search_events_cleared?: unknown; usage_events_cleared?: unknown }
    | null
    | undefined;
  return {
    ok: true,
    searchCleared: count(row?.search_events_cleared),
    usageCleared: count(row?.usage_events_cleared),
    pending: false,
  };
}
