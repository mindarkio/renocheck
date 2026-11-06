import { getOrCreateAnonId } from "@/lib/anon-id";
import type { UsageDetailCode, UsageEventType } from "@/lib/usage-event";

const FINGERPRINT_RE = /^[0-9a-f]{32}$/;

/**
 * Fire-and-forget. Failures, 429s, and a missing table must not surface in the UI.
 * credentials omit: the id is in the JSON body, not a cookie.
 * `detail` is a reason code, never a name, email, phone, or filename.
 */
export function sendUsageEvent(
  eventType: UsageEventType,
  extra?: { fingerprint?: string; detail?: UsageDetailCode },
): void {
  if (typeof window === "undefined") return;
  const anonId = getOrCreateAnonId();
  if (!anonId) return;

  const payload: {
    anonId: string;
    eventType: UsageEventType;
    fingerprint?: string;
    detail?: UsageDetailCode;
  } = {
    anonId,
    eventType,
  };
  if (extra?.fingerprint && FINGERPRINT_RE.test(extra.fingerprint)) {
    payload.fingerprint = extra.fingerprint;
  }
  if (extra?.detail) payload.detail = extra.detail;

  try {
    void fetch("/api/usage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "omit",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics never blocks the page.
  }
}
