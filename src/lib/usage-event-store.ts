import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { isSyntheticProbeTerm } from "@/lib/synthetic-probe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  isMissingUsageEventsTable,
  type UsageEventType,
} from "@/lib/usage-event";

export type UsageWriteResult = "saved" | "skipped";

type CacheTermRow = { term: string | null };

/**
 * Insert one usage event. Skips (no throw) when the table is missing, Supabase
 * is unconfigured, the prod-db guard refuses, or the fingerprint is a ZZQ probe.
 * The row is only anon_id, event_type, fingerprint, and created_at (default).
 */
export async function recordUsageEvent(
  supabase: SupabaseClient | null,
  input: {
    anonId: string;
    eventType: UsageEventType;
    fingerprint: string | null;
  },
): Promise<UsageWriteResult> {
  try {
    assertNotProdDbOutsideProd();
  } catch (error) {
    if (error instanceof Error && error.message === "refusing_prod_db") {
      return "skipped";
    }
    throw error;
  }

  const client = supabase ?? getSupabaseAdmin();
  if (!client) return "skipped";

  try {
    if (input.fingerprint && (await isProbeFingerprint(client, input.fingerprint))) {
      return "skipped";
    }

    const row = {
      anon_id: input.anonId,
      event_type: input.eventType,
      fingerprint: input.fingerprint,
    };
    const { error } = await client.from("usage_events").insert(row);
    if (!error) return "saved";
    if (isMissingUsageEventsTable(error)) return "skipped";

    console.warn(
      JSON.stringify({
        event: "usage_event_skipped",
        code: error.code ?? "insert_failed",
      }),
    );
    return "skipped";
  } catch {
    console.warn(JSON.stringify({ event: "usage_event_skipped", code: "insert_threw" }));
    return "skipped";
  }
}

async function isProbeFingerprint(
  supabase: SupabaseClient,
  fingerprint: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("search_cache")
    .select("term:query_input->>companyName")
    .eq("fingerprint", fingerprint)
    .maybeSingle();
  if (error || !data) return false;
  const term = (data as CacheTermRow).term ?? "";
  return isSyntheticProbeTerm(term);
}
