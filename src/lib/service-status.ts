import "server-only";
import {
  nextPacificReset,
  onGeminiAttempt,
  type GeminiAttempt,
} from "./gemini-usage";

const FIVE_MIN_MS = 5 * 60 * 1000;
const MIN_COOLDOWN_S = 120;
/** Upper bound for a Google RetryInfo delay, so a bad value cannot pause search for days. */
const MAX_COOLDOWN_S = 15 * 60;
/** AI SDK retries (default 2, ~2s/4s backoff) land inside this window; count them as one failure. */
const RETRY_BURST_MS = 15_000;

type OpenReason = "gemini_quota_day" | "gemini_errors";

type BreakerState = {
  openUntilMs: number;
  openReason: OpenReason | null;
  streak: { at: number; retryDelayS?: number }[];
};

/** One copy per process: route handlers and pages load separate module graphs. */
const STATE_KEY = Symbol.for("renocheck.serviceStatus.v1");
const globalStore = globalThis as unknown as Record<symbol, BreakerState | undefined>;
const state: BreakerState = (globalStore[STATE_KEY] ??= {
  openUntilMs: 0,
  openReason: null,
  streak: [],
});

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
      state.streak = [];
      return;
    }
    if (attempt.outcome === "quota_day") {
      const until = nextPacificReset(new Date(attempt.at)).getTime();
      if (until > state.openUntilMs) {
        state.openUntilMs = until;
        state.openReason = "gemini_quota_day";
      }
      return;
    }
    if (attempt.aborted || !isStreakOutcome(attempt.outcome)) return;
    const streak = state.streak.filter((row) => attempt.at - row.at <= FIVE_MIN_MS);
    const last = streak[streak.length - 1];
    if (last && attempt.at - last.at < RETRY_BURST_MS) {
      last.retryDelayS = Math.max(last.retryDelayS ?? 0, attempt.retryDelayS ?? 0);
      state.streak = streak;
      return;
    }
    streak.push({ at: attempt.at, retryDelayS: attempt.retryDelayS });
    state.streak = streak;
    if (streak.length < 3) return;
    const delayS = Math.min(
      MAX_COOLDOWN_S,
      streak.reduce(
        (max, row) => Math.max(max, row.retryDelayS ?? 0),
        MIN_COOLDOWN_S,
      ),
    );
    const until = attempt.at + delayS * 1000;
    state.streak = [];
    if (until > state.openUntilMs) {
      state.openUntilMs = until;
      state.openReason = "gemini_errors";
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
  if (state.openReason && t < state.openUntilMs) {
    return { paused: true, reason: state.openReason };
  }
  return { paused: false, reason: null };
}

export function resetServiceStatusForTests(): void {
  state.openUntilMs = 0;
  state.openReason = null;
  state.streak = [];
}
