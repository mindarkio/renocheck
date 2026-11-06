import {
  isCrCircuitOpen,
  recordCrApiFailure,
  recordCrApiSuccess,
} from "./circuit-breaker";
import { scheduleCrApiRequest } from "./throttle";
import type { CrApiLocalRow } from "./types";

const LOCAL_SEARCH_URL =
  "https://data.cr.gov.hk/cr/api/api/v1/api_builder/json/local/search";

const MAX_BODY_BYTES = 2_000_000;
const CR_UPSTREAM_SLOW_MS = 3000;
/**
 * One upstream attempt. 2026-10-19 samples were often 9–14s; 16s still fits
 * one retry inside the 25s lookup budget when the first attempt fails fast.
 */
const CR_ATTEMPT_TIMEOUT_MS = 16_000;
const CR_MIN_RETRY_BUDGET_MS = 8_000;
const CR_MAX_ATTEMPTS = 2;
const HTML_NO_RESULT_MARKERS = ["Invalid Request", "400_ZH.html"] as const;

export type CrLocalSearchResult =
  | { kind: "rows"; rows: CrApiLocalRow[] }
  | { kind: "no_result" }
  | { kind: "error"; message: string };

export type CrFetchOptions = {
  signal?: AbortSignal;
  /** Lookup wall-clock deadline (ms since epoch) for throttle queue budget. */
  deadlineMs?: number;
  /** Per-lookup counters for logging only; never holds row data. */
  stats?: { fetchCount: number; lastHttpStatus: number | null };
};

function buildSearchUrl(
  key1: string,
  key2: string,
  key3: string,
): string {
  const params = new URLSearchParams();
  params.set("query[0][key1]", key1);
  params.set("query[0][key2]", key2);
  params.set("query[0][key3]", key3);
  params.set("format", "json");
  return `${LOCAL_SEARCH_URL}?${params.toString()}`;
}

function parseNoResultMessage(body: unknown, httpStatus: number): boolean {
  if (httpStatus !== 400) return false;
  if (typeof body !== "object" || body === null) return false;
  const o = body as { status?: number; message?: string };
  if (o.status !== 400) return false;
  const msg = (o.message ?? "").trim();
  return /^no result found\.?$/i.test(msg);
}

/**
 * Zero-row local search on 2026-11-06: HTTP 400 plus a static HTML shell
 * (`Invalid Request` and `400_ZH.html`). That shell is byte-identical for a
 * malformed filter, which this client never sends (only `Brn`/`equal` and
 * `Comp_name`/`begins_with`). 5xx, timeouts, and any other HTML stay errors.
 */
export function isCrHtmlNoResultPage(httpStatus: number, body: string): boolean {
  if (httpStatus !== 400) return false;
  if (body.length === 0 || body.length > 20_000) return false;
  const trimmed = body.trimStart();
  if (!trimmed.startsWith("<!") && !trimmed.toLowerCase().startsWith("<html")) {
    return false;
  }
  return HTML_NO_RESULT_MARKERS.every((marker) => body.includes(marker));
}

function isRetryableCrFailure(message: string): boolean {
  if (message === "fetch_failed" || message === "timeout") return true;
  return /^http_(408|500|502|503|504)$/.test(message);
}

type CrFetchAttempt = {
  result: CrLocalSearchResult;
  countAsSuccess: boolean;
  countAsFailure: boolean;
  countAsRateLimit: boolean;
  httpStatus: number | null;
  retryAfter: string | null;
  elapsedMs: number;
  parentAborted: boolean;
};

function attemptTimeoutMs(
  deadlineMs: number | undefined,
  attemptIndex: number,
): number {
  const remaining =
    deadlineMs === undefined ? CR_ATTEMPT_TIMEOUT_MS : deadlineMs - Date.now();
  if (remaining <= 0) return 0;
  if (attemptIndex > 0) return remaining;
  if (remaining >= CR_ATTEMPT_TIMEOUT_MS + CR_MIN_RETRY_BUDGET_MS) {
    return CR_ATTEMPT_TIMEOUT_MS;
  }
  return remaining;
}

function linkAttemptAbort(
  parent: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const abortFromParent = () => {
    if (!controller.signal.aborted) {
      controller.abort(parent?.reason ?? new DOMException("budget", "AbortError"));
    }
  };
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });
  const timer = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort(new DOMException("attempt", "TimeoutError"));
    }
  }, Math.max(0, timeoutMs));
  (timer as { unref?: () => void }).unref?.();
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}

function canRetryAttempt(
  message: string,
  deadlineMs: number | undefined,
  parentAborted: boolean,
): boolean {
  if (parentAborted || !isRetryableCrFailure(message)) return false;
  if (
    deadlineMs !== undefined &&
    deadlineMs - Date.now() < CR_MIN_RETRY_BUDGET_MS
  ) {
    return false;
  }
  return true;
}

function settleAttempt(attempt: CrFetchAttempt): void {
  if (attempt.countAsSuccess) {
    recordCrApiSuccess();
    return;
  }
  if (attempt.countAsRateLimit) {
    recordCrApiFailure(429, attempt.retryAfter);
    return;
  }
  if (attempt.countAsFailure) {
    recordCrApiFailure(attempt.httpStatus ?? 0);
  }
}

/**
 * Record here, not in the caller. A parent abort resolves the throttle wrapper
 * before this attempt's promise is observed, but the breaker still has to see
 * a slow upstream timeout.
 */
function finishAttempt(
  attempt: CrFetchAttempt,
  deferRetryable: boolean,
): CrFetchAttempt {
  const message = attempt.result.kind === "error" ? attempt.result.message : "";
  const retryable =
    attempt.result.kind === "error" &&
    !attempt.parentAborted &&
    isRetryableCrFailure(message);
  if (!(deferRetryable && retryable)) {
    settleAttempt(attempt);
  }
  return attempt;
}

function failureAttempt(
  message: string,
  startedAt: number,
  httpStatus: number | null,
  extras?: {
    countAsFailure?: boolean;
    countAsRateLimit?: boolean;
    retryAfter?: string | null;
    parentAborted?: boolean;
  },
): CrFetchAttempt {
  const elapsedMs = Date.now() - startedAt;
  const slowTimeout = message === "timeout" && elapsedMs >= CR_UPSTREAM_SLOW_MS;
  return {
    result: { kind: "error", message },
    countAsSuccess: false,
    countAsFailure: extras?.countAsFailure ?? (message === "timeout" ? slowTimeout : true),
    countAsRateLimit: extras?.countAsRateLimit ?? false,
    httpStatus,
    retryAfter: extras?.retryAfter ?? null,
    elapsedMs,
    parentAborted: extras?.parentAborted ?? false,
  };
}

async function performCrFetch(
  key1: string,
  key2: string,
  key3: string,
  parent: AbortSignal | undefined,
  attemptIndex: number,
  deferRetryable: boolean,
  options?: CrFetchOptions,
): Promise<CrFetchAttempt> {
  const startedAt = Date.now();
  const linked = linkAttemptAbort(
    parent,
    attemptTimeoutMs(options?.deadlineMs, attemptIndex),
  );
  let responded = false;
  try {
    if (parent?.aborted || linked.signal.aborted) {
      return finishAttempt(
        failureAttempt("timeout", startedAt, null, {
          countAsFailure: false,
          parentAborted: Boolean(parent?.aborted),
        }),
        deferRetryable,
      );
    }
    const res = await fetch(buildSearchUrl(key1, key2, key3), {
      signal: linked.signal,
      headers: { Accept: "application/json" },
    });
    responded = true;
    if (options?.stats) {
      options.stats.fetchCount += 1;
      options.stats.lastHttpStatus = res.status;
    }
    const len = res.headers.get("content-length");
    if (len && Number.parseInt(len, 10) > MAX_BODY_BYTES) {
      return finishAttempt(
        failureAttempt("too_large", startedAt, res.status),
        deferRetryable,
      );
    }
    const text = await res.text();
    if (text.length > MAX_BODY_BYTES) {
      return finishAttempt(
        failureAttempt("too_large", startedAt, res.status),
        deferRetryable,
      );
    }
    if (isCrHtmlNoResultPage(res.status, text)) {
      return finishAttempt(
        {
          result: { kind: "no_result" },
          countAsSuccess: true,
          countAsFailure: false,
          countAsRateLimit: false,
          httpStatus: res.status,
          retryAfter: null,
          elapsedMs: Date.now() - startedAt,
          parentAborted: false,
        },
        deferRetryable,
      );
    }
    let body: unknown;
    try {
      body = text.length === 0 ? null : JSON.parse(text);
    } catch {
      if (res.status === 429) {
        return finishAttempt(
          failureAttempt("http_429", startedAt, 429, {
            countAsFailure: false,
            countAsRateLimit: true,
            retryAfter: res.headers.get("retry-after"),
          }),
          deferRetryable,
        );
      }
      if (res.status >= 500 || res.status === 408) {
        return finishAttempt(
          failureAttempt(`http_${res.status}`, startedAt, res.status),
          deferRetryable,
        );
      }
      if (!res.ok) {
        return finishAttempt(
          failureAttempt(`http_${res.status}`, startedAt, res.status),
          deferRetryable,
        );
      }
      return finishAttempt(
        failureAttempt("invalid_json", startedAt, res.status),
        deferRetryable,
      );
    }
    if (res.status === 429) {
      return finishAttempt(
        failureAttempt("http_429", startedAt, 429, {
          countAsFailure: false,
          countAsRateLimit: true,
          retryAfter: res.headers.get("retry-after"),
        }),
        deferRetryable,
      );
    }
    if (parseNoResultMessage(body, res.status)) {
      return finishAttempt(
        {
          result: { kind: "no_result" },
          countAsSuccess: true,
          countAsFailure: false,
          countAsRateLimit: false,
          httpStatus: res.status,
          retryAfter: null,
          elapsedMs: Date.now() - startedAt,
          parentAborted: false,
        },
        deferRetryable,
      );
    }
    if (res.status === 400) {
      return finishAttempt(
        failureAttempt("http_400", startedAt, res.status),
        deferRetryable,
      );
    }
    if (!res.ok) {
      return finishAttempt(
        failureAttempt(`http_${res.status}`, startedAt, res.status),
        deferRetryable,
      );
    }
    if (
      typeof body === "object" &&
      body !== null &&
      "status" in body &&
      (body as { status?: number }).status === 400
    ) {
      return finishAttempt(
        failureAttempt("body_status_400", startedAt, 200),
        deferRetryable,
      );
    }
    if (!Array.isArray(body)) {
      return finishAttempt(
        failureAttempt("unexpected_shape", startedAt, res.status),
        deferRetryable,
      );
    }
    return finishAttempt(
      {
        result: { kind: "rows", rows: body as CrApiLocalRow[] },
        countAsSuccess: true,
        countAsFailure: false,
        countAsRateLimit: false,
        httpStatus: res.status,
        retryAfter: null,
        elapsedMs: Date.now() - startedAt,
        parentAborted: false,
      },
      deferRetryable,
    );
  } catch (e) {
    if (options?.stats && !responded) {
      options.stats.fetchCount += 1;
    }
    const parentAborted = Boolean(parent?.aborted);
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return finishAttempt(
        failureAttempt("timeout", startedAt, null, { parentAborted }),
        deferRetryable,
      );
    }
    return finishAttempt(
      failureAttempt("fetch_failed", startedAt, null, { parentAborted }),
      deferRetryable,
    );
  } finally {
    linked.cancel();
  }
}

async function fetchLocalSearch(
  key1: string,
  key2: string,
  key3: string,
  options?: CrFetchOptions,
): Promise<CrLocalSearchResult> {
  const parent = options?.signal;
  if (parent?.aborted) {
    return { kind: "error", message: "timeout" };
  }
  if (isCrCircuitOpen()) {
    return { kind: "error", message: "circuit_open" };
  }

  let last: CrFetchAttempt | null = null;
  for (let attempt = 0; attempt < CR_MAX_ATTEMPTS; attempt++) {
    if (parent?.aborted) {
      return { kind: "error", message: "timeout" };
    }
    if (isCrCircuitOpen()) {
      return { kind: "error", message: "circuit_open" };
    }

    const scheduled = await scheduleCrApiRequest(
      () =>
        performCrFetch(
          key1,
          key2,
          key3,
          parent,
          attempt,
          attempt + 1 < CR_MAX_ATTEMPTS,
          options,
        ),
      { deadlineMs: options?.deadlineMs, signal: parent },
    );
    if (!scheduled.ok) {
      const reason = scheduled.reason === "queue_full" ? "queue_full" : "timeout";
      return { kind: "error", message: reason };
    }

    last = scheduled.value;
    const retry =
      attempt + 1 < CR_MAX_ATTEMPTS &&
      last.result.kind === "error" &&
      canRetryAttempt(
        last.result.message,
        options?.deadlineMs,
        last.parentAborted || Boolean(parent?.aborted),
      );
    if (!retry) {
      return last.result;
    }
  }

  if (last) {
    return last.result;
  }
  return { kind: "error", message: "fetch_failed" };
}

export async function searchCrLocalByBrnEqual(
  brn: string,
  options?: CrFetchOptions,
): Promise<CrLocalSearchResult> {
  return fetchLocalSearch("Brn", "equal", brn.trim(), options);
}

export async function searchCrLocalByNameBeginsWith(
  prefix: string,
  options?: CrFetchOptions,
): Promise<CrLocalSearchResult> {
  const p = prefix.trim();
  if (!p) return { kind: "no_result" };
  return fetchLocalSearch("Comp_name", "begins_with", p, options);
}
