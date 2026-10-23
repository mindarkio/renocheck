import { z } from "zod";
import { canonicalAnonId, isAnonId } from "@/lib/anon-id";

/** Lightweight events. Searches are stored on search_events, not here. */
export const USAGE_EVENT_TYPES = [
  "quote_page",
  "quote_all_ticked",
  "quote_copy_reply",
  "report_official_link",
  "report_share",
] as const;

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];

const FINGERPRINT_RE = /^[0-9a-f]{32}$/;

export const usageEventBodySchema = z
  .object({
    anonId: z
      .string()
      .refine(isAnonId)
      .transform(canonicalAnonId),
    eventType: z.enum(USAGE_EVENT_TYPES),
    fingerprint: z.string().regex(FINGERPRINT_RE).optional(),
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
  return (
    /usage_events/i.test(message) &&
    /does not exist|schema cache|could not find/i.test(message)
  );
}
