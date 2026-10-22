import "server-only";

/**
 * Counts real Gemini HTTP attempts, including AI SDK retries.
 * `createGoogleGenerativeAI({ fetch })` uses this function for every attempt
 * (default maxRetries is 2, so one search can be up to 3 requests).
 * Records stay in memory: model id, outcome, quota id/value, retry delay.
 * URLs, query strings, headers, keys, prompts and response text are not stored.
 */

export type GeminiOutcome =
  | "ok"
  | "rate_minute"
  | "quota_day"
  | "rate_other"
  | "server_5xx"
  | "client_4xx"
  | "network";

export type GeminiAttempt = {
  at: number;
  model: string;
  outcome: GeminiOutcome;
  quotaId?: string;
  quotaValue?: number;
  retryDelayS?: number;
};

export type GeminiUsageSnapshot = {
  instanceCalls: number;
  counts24h: Record<GeminiOutcome, number>;
  last429At: number | null;
  lastQuotaValue: number | null;
  records: GeminiAttempt[];
};

const CAP = 500;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const PACIFIC = "America/Los_Angeles";

const attempts: GeminiAttempt[] = [];
let fixtureSeeded = false;

type GeminiAttemptListener = (attempt: GeminiAttempt) => void;
let listener: GeminiAttemptListener | null = null;

/** Registered by the service-status breaker. Must not throw into fetch. */
export function onGeminiAttempt(fn: GeminiAttemptListener): void {
  listener = fn;
}

function emptyCounts(): Record<GeminiOutcome, number> {
  return {
    ok: 0,
    rate_minute: 0,
    quota_day: 0,
    rate_other: 0,
    server_5xx: 0,
    client_4xx: 0,
    network: 0,
  };
}

export function resetGeminiUsageForTests(): void {
  attempts.length = 0;
  fixtureSeeded = false;
}

type PacificParts = {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  s: number;
};

function readPacificParts(instant: Date): PacificParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let h = Number(map.hour);
  if (h === 24) h = 0;
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    h,
    min: Number(map.minute),
    s: Number(map.second),
  };
}

/** UTC instant whose America/Los_Angeles wall time is y-m-d 00:00:00. DST-safe. */
function pacificMidnightUtc(y: number, m: number, d: number): Date {
  const desiredAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  let guess = desiredAsUtc;
  for (let i = 0; i < 4; i++) {
    const parts = readPacificParts(new Date(guess));
    const actualAsUtc = Date.UTC(
      parts.y,
      parts.m - 1,
      parts.d,
      parts.h,
      parts.min,
      parts.s,
    );
    const diff = desiredAsUtc - actualAsUtc;
    if (diff === 0) return new Date(guess);
    guess += diff;
  }
  return new Date(guess);
}

function addCalendarDays(
  y: number,
  m: number,
  d: number,
  days: number,
): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Start of the Pacific calendar day that contains `now` (RPD reset boundary). */
export function pacificDayStart(now: Date): Date {
  const parts = readPacificParts(now);
  return pacificMidnightUtc(parts.y, parts.m, parts.d);
}

/** Next America/Los_Angeles midnight strictly after the Pacific date of `now`. */
export function nextPacificReset(now: Date): Date {
  const parts = readPacificParts(now);
  const next = addCalendarDays(parts.y, parts.m, parts.d, 1);
  return pacificMidnightUtc(next.y, next.m, next.d);
}

function prune(now: number): void {
  const cutoff = now - WINDOW_MS;
  while (attempts.length > 0 && attempts[0]!.at < cutoff) attempts.shift();
  while (attempts.length > CAP) attempts.shift();
}

function pushAttempt(attempt: GeminiAttempt, log: boolean): void {
  attempts.push(attempt);
  prune(attempt.at);
  if (log && attempt.outcome !== "ok") {
    console.warn(
      JSON.stringify({
        event: "gemini_http",
        outcome: attempt.outcome,
        quota_id: attempt.quotaId ?? null,
        model: attempt.model,
      }),
    );
  }
  try {
    listener?.(attempt);
  } catch {
    // The breaker must not break the Gemini call.
  }
}

/**
 * Dev-only overflow/screenshot seed. Ignored when NODE_ENV is production so a
 * stray flag cannot publish made-up Gemini usage.
 */
function maybeSeedDevFixture(now: number): void {
  if (process.env.NODE_ENV === "production") return;
  if (process.env.OVERFLOW_CHECK_GEMINI !== "1") return;
  if (fixtureSeeded) return;
  fixtureSeeded = true;
  pushAttempt(
    {
      at: now,
      model: "overflow-check",
      outcome: "quota_day",
      quotaId: "overflow-check-PerDay",
    },
    false,
  );
}

export function getGeminiUsageSnapshot(now = Date.now()): GeminiUsageSnapshot {
  maybeSeedDevFixture(now);
  prune(now);
  const dayStart = pacificDayStart(new Date(now)).getTime();
  const counts24h = emptyCounts();
  let instanceCalls = 0;
  let last429At: number | null = null;
  let lastQuotaValue: number | null = null;
  for (const rec of attempts) {
    counts24h[rec.outcome] += 1;
    if (rec.at >= dayStart) instanceCalls += 1;
    if (
      rec.outcome === "quota_day" ||
      rec.outcome === "rate_minute" ||
      rec.outcome === "rate_other"
    ) {
      if (last429At == null || rec.at >= last429At) last429At = rec.at;
      if (rec.quotaValue != null) lastQuotaValue = rec.quotaValue;
    }
  }
  return {
    instanceCalls,
    counts24h,
    last429At,
    lastQuotaValue,
    records: attempts.slice(),
  };
}

function modelFromRequest(input: RequestInfo | URL): string {
  try {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(raw);
    const match = url.pathname.match(/\/models\/([^/]+):/);
    if (!match?.[1]) return "unknown";
    return decodeURIComponent(match[1]).slice(0, 80);
  } catch {
    return "unknown";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseQuotaValue(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^-?\d+(\.\d+)?$/.test(raw.trim())) {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseRetryDelay(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  if (typeof raw === "string") {
    const match = raw.trim().match(/^(\d+(?:\.\d+)?)s$/);
    if (match?.[1]) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  const rec = asRecord(raw);
  if (rec && "seconds" in rec) {
    const n = Number(rec.seconds);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

function classify429(body: unknown): Omit<GeminiAttempt, "at" | "model"> {
  const root = asRecord(body);
  const error = root ? (asRecord(root.error) ?? root) : null;
  const detailsRaw = error?.details;
  const details = Array.isArray(detailsRaw)
    ? detailsRaw.map(asRecord).filter((d): d is Record<string, unknown> => d != null)
    : [];

  let outcome: "quota_day" | "rate_minute" | "rate_other" = "rate_other";
  let quotaId: string | undefined;
  let quotaValue: number | undefined;
  let retryDelayS: number | undefined;

  for (const detail of details) {
    const type = typeof detail["@type"] === "string" ? detail["@type"] : "";
    if (!type.includes("QuotaFailure")) continue;
    const violations = Array.isArray(detail.violations) ? detail.violations : [];
    for (const violation of violations) {
      const rec = asRecord(violation);
      if (!rec || typeof rec.quotaId !== "string") continue;
      const id = rec.quotaId;
      const idLower = id.toLowerCase();
      const value = parseQuotaValue(rec.quotaValue);
      if (idLower.includes("perday")) {
        outcome = "quota_day";
        quotaId = id;
        quotaValue = value;
      } else if (idLower.includes("perminute") && outcome !== "quota_day") {
        outcome = "rate_minute";
        quotaId = id;
        quotaValue = value;
      } else if (outcome === "rate_other") {
        quotaId = id;
        quotaValue = value;
      }
    }
  }

  for (const detail of details) {
    const type = typeof detail["@type"] === "string" ? detail["@type"] : "";
    if (!type.includes("RetryInfo")) continue;
    const parsed = parseRetryDelay(detail.retryDelay);
    if (parsed != null) retryDelayS = parsed;
  }

  return {
    outcome,
    ...(quotaId ? { quotaId } : {}),
    ...(quotaValue != null ? { quotaValue } : {}),
    ...(retryDelayS != null ? { retryDelayS } : {}),
  };
}

async function classifyResponse(
  res: Response,
): Promise<Omit<GeminiAttempt, "at" | "model">> {
  try {
    if (res.status >= 200 && res.status < 300) return { outcome: "ok" };
    if (res.status === 429) {
      try {
        const body: unknown = await res.clone().json();
        return classify429(body);
      } catch {
        return { outcome: "rate_other" };
      }
    }
    if (res.status >= 500) return { outcome: "server_5xx" };
    if (res.status >= 400) return { outcome: "client_4xx" };
    return { outcome: "ok" };
  } catch {
    if (res.status === 429) return { outcome: "rate_other" };
    if (res.status >= 500) return { outcome: "server_5xx" };
    if (res.status >= 400) return { outcome: "client_4xx" };
    return { outcome: "network" };
  }
}

export const geminiCountingFetch: typeof fetch = async (input, init) => {
  const model = modelFromRequest(input);
  const at = Date.now();
  let res: Response;
  try {
    res = await globalThis.fetch(input, init);
  } catch (err) {
    pushAttempt({ at, model, outcome: "network" }, true);
    throw err;
  }
  const classified = await classifyResponse(res);
  pushAttempt({ at, model, ...classified }, true);
  return res;
};
