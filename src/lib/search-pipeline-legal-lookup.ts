import type { SupabaseClient } from "@supabase/supabase-js";
import { isLegalEventsEnabled } from "./legal-events-config";
import {
  lookupLegalJudgments,
  type LegalLookupContext,
  type LegalLookupResult,
} from "./lookup-legal-judgments";

export const LEGAL_LOOKUP_TIMEOUT_MS = 3000;

export type LegalLookupStatus = "ok" | "error" | "timeout";

export type LegalLookupForSearchResult = LegalLookupResult & {
  status: LegalLookupStatus;
};

export function emptyLegalLookupResult(): LegalLookupResult {
  return { events: [], registryAsOf: undefined };
}

export function isLegalLookupDegraded(
  status: LegalLookupStatus,
): boolean {
  return status === "error" || status === "timeout";
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
): Promise<LegalLookupForSearchResult> {
  if (!isLegalEventsEnabled()) {
    return Promise.resolve({
      status: "ok",
      ...emptyLegalLookupResult(),
    });
  }

  const lookupPromise = lookupLegalJudgments(supabase, ctx)
    .then((result) => ({
      status: "ok" as const,
      ...result,
    }))
    .catch((err) => {
      logLegalLookupFailure(
        "error",
        err instanceof Error ? err.message : String(err),
      );
      return {
        status: "error" as const,
        ...emptyLegalLookupResult(),
      };
    });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<LegalLookupForSearchResult>((resolve) => {
    timeoutId = setTimeout(() => {
      logLegalLookupFailure("timeout");
      resolve({
        status: "timeout",
        ...emptyLegalLookupResult(),
      });
    }, LEGAL_LOOKUP_TIMEOUT_MS);
  });

  return Promise.race([lookupPromise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}
