import "server-only";
import {
  nextPacificReset,
  onGeminiAttempt,
  type GeminiAttempt,
} from "./gemini-usage";

const FIVE_MIN_MS = 5 * 60 * 1000;
const MIN_COOLDOWN_S = 120;

type OpenReason = "gemini_quota_day" | "gemini_errors";

let openUntilMs = 0;
let openReason: OpenReason | null = null;
let streak: { at: number; retryDelayS?: number }[] = [];

function isStreakOutcome(
  outcome: GeminiAttempt["outcome"],
): boolean {
  return (
    outcome === "rate_minute" ||
    outcome === "server_5xx" ||
    outcome === "network"
  );
}

/** Fed by the Gemini HTTP recorder. Never throws. */
export function ingestGeminiAttempt(attempt: GeminiAttempt): void {
  try {
    if (attempt.outcome === "ok") {
      streak = [];
      return;
    }
    if (attempt.outcome === "quota_day") {
      const until = nextPacificReset(new Date(attempt.at)).getTime();
      if (until > openUntilMs) {
        openUntilMs = until;
        openReason = "gemini_quota_day";
      }
      return;
    }
    if (!isStreakOutcome(attempt.outcome)) return;
    streak = streak.filter((row) => attempt.at - row.at <= FIVE_MIN_MS);
    streak.push({ at: attempt.at, retryDelayS: attempt.retryDelayS });
    if (streak.length < 3) return;
    const delayS = streak.reduce(
      (max, row) => Math.max(max, row.retryDelayS ?? 0),
      MIN_COOLDOWN_S,
    );
    const until = attempt.at + delayS * 1000;
    streak = [];
    if (until > openUntilMs) {
      openUntilMs = until;
      openReason = "gemini_errors";
    }
  } catch {
    // Ignore breaker bugs; the HTTP call already finished.
  }
}

onGeminiAttempt(ingestGeminiAttempt);

export type ServiceStatus = {
  paused: boolean;
  reason: "manual" | "gemini_quota_day" | "gemini_errors" | null;
};

export function getServiceStatus(now: number | Date = Date.now()): ServiceStatus {
  if (process.env.SERVICE_PAUSED === "1") {
    return { paused: true, reason: "manual" };
  }
  const t = typeof now === "number" ? now : now.getTime();
  if (openReason && t < openUntilMs) {
    return { paused: true, reason: openReason };
  }
  return { paused: false, reason: null };
}

export function resetServiceStatusForTests(): void {
  openUntilMs = 0;
  openReason = null;
  streak = [];
}
