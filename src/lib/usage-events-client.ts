import { getOrCreateAnonId } from "@/lib/anon-id";
import type { UsageEventType } from "@/lib/usage-event";

const FINGERPRINT_RE = /^[0-9a-f]{32}$/;

/**
 * Fire-and-forget. Failures, 429s, and a missing table must not surface in the UI.
 * credentials omit: the id is in the JSON body, not a cookie.
 */
export function sendUsageEvent(
  eventType: UsageEventType,
  extra?: { fingerprint?: string },
): void {
  if (typeof window === "undefined") return;
  const anonId = getOrCreateAnonId();
  if (!anonId) return;

  const payload: { anonId: string; eventType: UsageEventType; fingerprint?: string } = {
    anonId,
    eventType,
  };
  if (extra?.fingerprint && FINGERPRINT_RE.test(extra.fingerprint)) {
    payload.fingerprint = extra.fingerprint;
  }

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
