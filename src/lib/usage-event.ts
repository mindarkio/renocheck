import { z } from "zod";
import { canonicalAnonId, isAnonId } from "@/lib/anon-id";

/**
 * Lightweight events. Searches are stored on search_events, not here.
 * `quote_all_ticked` and `quote_copy_reply` are the retired checklist.
 * They stay in the allow-list so historical rows still count.
 */
export const USAGE_EVENT_TYPES = [
  "quote_page",
  "quote_upload_open",
  "quote_upload_unavailable",
  "quote_file_pick",
  "quote_extract_start",
  "quote_extract_ok",
  "quote_extract_fail",
  "quote_otp_start",
  "quote_otp_success",
  "quote_otp_fail",
  "quote_analyze_start",
  "quote_analyze_ok",
  "quote_analyze_fail",
  "quote_all_ticked",
  "quote_copy_reply",
  "report_official_link",
  "report_share",
] as const;

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];

/** Reason codes only. Never a name, email, phone, filename, or free text. */
export const USAGE_DETAIL_CODES = [
  "ack",
  "anon_limited",
  "auth_required",
  "budget",
  "forbidden",
  "invalid_input",
  "invalid_pdf",
  "llm_failed",
  "network",
  "not_quotation",
  "quota",
  "rate_limited",
  "unavailable",
  "unknown",
] as const;

export type UsageDetailCode = (typeof USAGE_DETAIL_CODES)[number];

const API_ERROR_TO_DETAIL: Record<string, UsageDetailCode> = {
  acknowledgement_required: "ack",
  anon_limited: "anon_limited",
  auth_required: "auth_required",
  forbidden: "forbidden",
  invalid_code: "invalid_input",
  invalid_input: "invalid_input",
  invalid_pdf: "invalid_pdf",
  not_quotation: "not_quotation",
  quota: "quota",
  quote_llm_failed: "llm_failed",
  quote_paused: "budget",
  quote_unavailable: "unavailable",
  rate_limited: "rate_limited",
  unavailable: "unavailable",
};

/** Maps an API `error` code onto the allow-list. Anything else is `unknown`. */
export function usageDetailFromError(code: string | null | undefined): UsageDetailCode {
  if (!code) return "unknown";
  return API_ERROR_TO_DETAIL[code] ?? "unknown";
}

export function isUsageDetailCode(value: string | null | undefined): value is UsageDetailCode {
  return typeof value === "string" && (USAGE_DETAIL_CODES as readonly string[]).includes(value);
}

const FINGERPRINT_RE = /^[0-9a-f]{32}$/;

export const usageEventBodySchema = z
  .object({
    anonId: z
      .string()
      .refine(isAnonId)
      .transform(canonicalAnonId),
    eventType: z.enum(USAGE_EVENT_TYPES),
    fingerprint: z.string().regex(FINGERPRINT_RE).optional(),
    detail: z.enum(USAGE_DETAIL_CODES).optional(),
  })
  .strict();

export type UsageEventBody = z.infer<typeof usageEventBodySchema>;

type DbError = { code?: string; message?: string; details?: string } | null | undefined;

export function isMissingAnonIdColumn(error: DbError): boolean {
  if (!error) return false;
  const blob = `${error.message ?? ""} ${error.details ?? ""}`;
  if (!/anon_id/i.test(blob)) return false;
  const code = error.code ?? "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist|schema cache|could not find/i.test(blob)
  );
}

export function isMissingUsageEventsTable(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = `${error.message ?? ""} ${error.details ?? ""}`;
  if (/\bcolumn\b/i.test(message)) return false;
  return (
    /usage_events/i.test(message) &&
    /does not exist|schema cache|could not find/i.test(message)
  );
}

/** True when `detail` has not been migrated. A missing table is not this case. */
export function isMissingUsageDetailColumn(error: DbError): boolean {
  if (!error || isMissingUsageEventsTable(error)) return false;
  const blob = `${error.message ?? ""} ${error.details ?? ""}`;
  if (!/\bdetail\b/i.test(blob)) return false;
  const code = error.code ?? "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist|schema cache|could not find/i.test(blob)
  );
}
