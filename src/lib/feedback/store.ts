import { REPORT_VERSION } from "@/lib/constants";
import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import {
  createDeviceId,
  hashDeviceId,
  readDeviceIdFromCookieHeader,
} from "@/lib/device-id";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { quoteHashSecret } from "./config";
import { logFeedback } from "./log";
import { redactFeedbackComment } from "./redact";
import type { FeedbackBody } from "./schema";

type DbError = { code?: string; message?: string } | null;

export function isMissingReportFeedbackTable(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return (
    /report_feedback/i.test(message) &&
    /does not exist|schema cache/i.test(message)
  );
}

/** Rows with created_at strictly before this instant are past the 12-month keep. */
export function feedbackPurgeCutoff(now = new Date()): string {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
  return cutoff.toISOString();
}

export type SubmitFeedbackResult = {
  status: 204 | 404 | 503;
  deviceId?: string;
  code: string;
};

export async function submitCompanyReportFeedback(
  input: FeedbackBody & { cookieHeader: string | null },
): Promise<SubmitFeedbackResult> {
  const secret = quoteHashSecret();
  if (!secret) {
    logFeedback({ event: "feedback_unavailable", code: "secret_missing" });
    return { status: 503, code: "secret_missing" };
  }

  try {
    assertNotProdDbOutsideProd();
  } catch (error) {
    if (error instanceof Error && error.message === "refusing_prod_db") {
      logFeedback({ event: "feedback_unavailable", code: "refusing_prod_db" });
      return { status: 503, code: "refusing_prod_db" };
    }
    throw error;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    logFeedback({ event: "feedback_unavailable", code: "db_unconfigured" });
    return { status: 503, code: "db_unconfigured" };
  }

  const existing = readDeviceIdFromCookieHeader(input.cookieHeader);
  const deviceId = existing ?? createDeviceId();
  const deviceHash = hashDeviceId(secret, deviceId);

  const refLookup = await supabase
    .from("search_cache")
    .select("fingerprint")
    .eq("fingerprint", input.reportRef)
    .maybeSingle();

  if (refLookup.error) {
    logFeedback({ event: "feedback_unavailable", code: "ref_lookup_failed" });
    return { status: 503, deviceId, code: "ref_lookup_failed" };
  }

  if (!refLookup.data) {
    logFeedback({
      event: "feedback_ref_missing",
      surface: input.surface,
      placement: input.placement,
      rating: input.rating,
      code: "not_found",
    });
    return { status: 404, deviceId, code: "not_found" };
  }

  const redacted = input.comment ? redactFeedbackComment(input.comment) : "";
  const comment = redacted.length > 0 ? redacted : null;

  const write = await supabase.from("report_feedback").upsert(
    {
      surface: input.surface,
      report_ref: input.reportRef,
      report_version: REPORT_VERSION,
      rating: input.rating,
      comment,
      placement: input.placement,
      device_hash: deviceHash,
    },
    { onConflict: "surface,report_ref,device_hash" },
  );

  if (write.error) {
    const code = isMissingReportFeedbackTable(write.error)
      ? "table_missing"
      : "write_failed";
    logFeedback({ event: "feedback_unavailable", code });
    return { status: 503, deviceId, code };
  }

  logFeedback({
    event: "feedback_saved",
    surface: input.surface,
    placement: input.placement,
    rating: input.rating,
    code: "saved",
  });
  return { status: 204, deviceId, code: "saved" };
}

export async function purgeExpiredFeedback(now = new Date()): Promise<
  | { ok: true; deleted: number }
  | { ok: false; code: "refusing_prod_db" | "db_unconfigured" | "delete_failed" }
> {
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

  const cutoff = feedbackPurgeCutoff(now);
  const { error, count } = await supabase
    .from("report_feedback")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) {
    if (isMissingReportFeedbackTable(error)) {
      return { ok: true, deleted: 0 };
    }
    return { ok: false, code: "delete_failed" };
  }

  return { ok: true, deleted: count ?? 0 };
}
