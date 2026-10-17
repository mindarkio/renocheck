import type { SupabaseClient } from "@supabase/supabase-js";
import { isLegalEventsEnabled } from "./legal-events-config";
import {
  lookupLegalJudgments,
  type LegalLookupContext,
  type LegalLookupResult,
} from "./lookup-legal-judgments";

export const LEGAL_LOOKUP_TIMEOUT_MS = 3000;

export function emptyLegalLookupResult(): LegalLookupResult {
  return { events: [], registryAsOf: undefined };
}

function logLegalLookupFailure(reason: "error" | "timeout", detail?: string) {
  console.warn(
    JSON.stringify({
      event:
        reason === "timeout" ? "legal_lookup_timeout" : "legal_lookup_failed",
      ...(reason === "timeout"
        ? { timeout_ms: LEGAL_LOOKUP_TIMEOUT_MS }
        : { message: detail?.slice(0, 200) ?? "unknown" }),
    }),
  );
}

/**
 * Non-blocking legal lookup for search pipeline: errors and slow responses
 * degrade to empty events (search continues).
 */
export function startLegalLookupForSearch(
  supabase: SupabaseClient,
  ctx: LegalLookupContext,
): Promise<LegalLookupResult> {
  if (!isLegalEventsEnabled()) {
    return Promise.resolve(emptyLegalLookupResult());
  }

  const lookupPromise = lookupLegalJudgments(supabase, ctx).catch((err) => {
    logLegalLookupFailure(
      "error",
      err instanceof Error ? err.message : String(err),
    );
    return emptyLegalLookupResult();
  });

  const timeoutPromise = new Promise<LegalLookupResult>((resolve) => {
    setTimeout(() => {
      logLegalLookupFailure("timeout");
      resolve(emptyLegalLookupResult());
    }, LEGAL_LOOKUP_TIMEOUT_MS);
  });

  return Promise.race([lookupPromise, timeoutPromise]);
}
