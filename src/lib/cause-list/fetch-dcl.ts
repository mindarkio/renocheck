import { FetchFatal } from "../bd-register/fetch-csv";
import { DCL_LIVE_ORIGIN } from "./dcl-url";

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [5000, 10000, 20000];

export type FetchDclOptions = {
  userAgent: string;
  timeoutMs?: number;
  maxRetries?: number;
};

export { FetchFatal };

export function parseRobotsDisallowPrefixes(robotsText: string): string[] {
  const prefixes: string[] = [];
  let applies = false;
  for (const line of robotsText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^user-agent:\s*\*/i.test(trimmed)) applies = true;
    if (/^user-agent:/i.test(trimmed) && !/\*/i.test(trimmed)) applies = false;
    const m = trimmed.match(/^disallow:\s*(.+)$/i);
    if (applies && m) prefixes.push(m[1].trim());
  }
  return prefixes;
}

export function isPathDisallowedByRobots(
  pathname: string,
  disallowPrefixes: string[],
): boolean {
  for (const prefix of disallowPrefixes) {
    if (prefix === "") continue;
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

type RobotsResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

const JUDICIARY_ROBOTS_PRIMARY = `${DCL_LIVE_ORIGIN}/robots.txt`;
const JUDICIARY_ROBOTS_FALLBACK = "https://www.e-services.judiciary.hk/robots.txt";
const MAX_ROBOTS_REDIRECTS = 3;
const ROBOTS_BODY_LIMIT = 512 * 1024;
const ROBOTS_HOSTS = new Set(["e-services.judiciary.hk", "www.e-services.judiciary.hk"]);
const APPLIED_TO_HOST = "e-services.judiciary.hk";

export type RobotsDecisionLogger = (
  event: Record<string, string | number>,
) => void;

export type JudiciaryRobotsOptions = {
  allowFallback: boolean;
};

type RobotsFetchResponse = {
  status: number;
  headers?: { get(name: string): string | null };
  body?: {
    getReader(): {
      read(): Promise<{ done: boolean; value?: Uint8Array }>;
      cancel(): Promise<void>;
    };
  } | null;
  text: () => Promise<string>;
};

type RobotsHop =
  | { kind: "done"; status: number; body: string; host: string; reason?: "html_not_robots" }
  | { kind: "network"; host: string }
  | { kind: "bad_redirect"; status: number; host: string };

async function readRobotsBody(res: RobotsFetchResponse): Promise<string> {
  const readable = res.body;
  if (readable && typeof readable.getReader === "function") {
    const reader = readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (total < ROBOTS_BODY_LIMIT) {
        const { done, value } = await reader.read();
        if (done || !value || value.byteLength === 0) {
          if (done) break;
          continue;
        }
        const take = Math.min(value.byteLength, ROBOTS_BODY_LIMIT - total);
        chunks.push(take === value.byteLength ? value : value.subarray(0, take));
        total += take;
      }
    } finally {
      await Promise.resolve(reader.cancel()).catch(() => undefined);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  }
  return res.text();
}

function isHtmlRobotsImposter(res: RobotsFetchResponse, body: string): boolean {
  const contentType = res.headers?.get("content-type") ?? "";
  return contentType.toLowerCase().includes("text/html") && !/^user-agent:/im.test(body);
}

async function fetchRobotsUrl(startUrl: string, userAgent: string): Promise<RobotsHop> {
  let current = startUrl;
  for (let redirects = 0; ; redirects++) {
    let res: RobotsFetchResponse;
    try {
      res = (await fetch(current, {
        headers: { "User-Agent": userAgent },
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      })) as RobotsFetchResponse;
    } catch {
      return { kind: "network", host: new URL(current).hostname };
    }
    const host = new URL(current).hostname;
    if (res.status >= 300 && res.status < 400) {
      if (redirects >= MAX_ROBOTS_REDIRECTS) {
        return { kind: "bad_redirect", status: res.status, host };
      }
      const location = res.headers?.get("location");
      if (!location) return { kind: "bad_redirect", status: res.status, host };
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { kind: "bad_redirect", status: res.status, host };
      }
      if (
        next.protocol !== "https:" ||
        !ROBOTS_HOSTS.has(next.hostname) ||
        next.port !== "" ||
        next.username !== "" ||
        next.password !== ""
      ) {
        return { kind: "bad_redirect", status: res.status, host };
      }
      current = next.toString();
      continue;
    }
    if (res.status !== 200) return { kind: "done", status: res.status, body: "", host };
    let body: string;
    try {
      body = await readRobotsBody(res);
    } catch {
      return { kind: "network", host };
    }
    if (isHtmlRobotsImposter(res, body)) {
      return { kind: "done", status: res.status, body: "", host, reason: "html_not_robots" };
    }
    return { kind: "done", status: res.status, body, host };
  }
}

function robotsUnavailable(status: number | "network" | "redirect"): Error {
  if (status === "network") return new Error("robots.txt unavailable (network)");
  if (status === "redirect") return new Error("robots.txt unavailable (redirect)");
  if (status >= 500) return new Error("robots.txt unavailable (5xx)");
  return new Error(`robots.txt unavailable (${status})`);
}

type RobotsClass =
  | { action: "prefixes"; prefixes: string[]; host: string; status: number; reason?: "html_not_robots" }
  | { action: "allow"; host: string; status: number; reason?: "html_not_robots" }
  | { action: "fallback" }
  | { action: "fail"; host: string; status: number; error: Error; reason?: "html_not_robots" };

function classifyRobotsHop(hop: RobotsHop): RobotsClass {
  if (hop.kind === "network") return { action: "fallback" };
  if (hop.kind === "done" && hop.reason === "html_not_robots") return { action: "fallback" };
  if (hop.kind === "bad_redirect") {
    return {
      action: "fail",
      host: hop.host,
      status: hop.status,
      error: robotsUnavailable("redirect"),
    };
  }
  if (hop.status === 200) {
    return {
      action: "prefixes",
      prefixes: parseRobotsDisallowPrefixes(hop.body),
      host: hop.host,
      status: hop.status,
    };
  }
  if (hop.status === 404 || hop.status === 410) {
    return { action: "allow", host: hop.host, status: hop.status };
  }
  if (hop.status >= 500) return { action: "fallback" };
  return {
    action: "fail",
    host: hop.host,
    status: hop.status,
    error: robotsUnavailable(hop.status),
  };
}

type SettledRobots = Exclude<RobotsClass, { action: "fallback" }>;

type DecisionMeta =
  | { basis: "primary" }
  | { basis: "fallback_host"; primaryStatus: number; primaryReason?: "html_not_robots" };

function decisionEvent(
  classified: { host: string; status: number; reason?: "html_not_robots" },
  result: "parsed" | "allow" | "fail_closed",
  meta: DecisionMeta,
): Record<string, string | number> {
  const event: Record<string, string | number> = {
    event: "robots_decision",
    host: classified.host,
    status: classified.status,
    result,
    appliedTo: APPLIED_TO_HOST,
    basis: meta.basis,
  };
  if (classified.reason) event.reason = classified.reason;
  if (meta.basis === "fallback_host") {
    event.primaryStatus = meta.primaryStatus;
    if (meta.primaryReason) event.primaryReason = meta.primaryReason;
  }
  return event;
}

function unexpectedRobotsClass(value: never): never {
  throw new Error(`unexpected robots class ${JSON.stringify(value)}`);
}

function settleRobots(
  classified: SettledRobots,
  log: RobotsDecisionLogger | undefined,
  meta: DecisionMeta,
): string[] {
  if (classified.action === "prefixes") {
    log?.(decisionEvent(classified, "parsed", meta));
    return classified.prefixes;
  }
  if (classified.action === "allow") {
    log?.(decisionEvent(classified, "allow", meta));
    return [];
  }
  if (classified.action === "fail") {
    log?.(decisionEvent(classified, "fail_closed", meta));
    throw classified.error;
  }
  return unexpectedRobotsClass(classified);
}

function hopStatus(hop: RobotsHop): number {
  return hop.kind === "network" ? 0 : hop.status;
}

function failClosed(hop: RobotsHop): SettledRobots {
  if (hop.kind === "network") {
    return { action: "fail", host: hop.host, status: 0, error: robotsUnavailable("network") };
  }
  if (hop.kind === "bad_redirect") {
    return {
      action: "fail",
      host: hop.host,
      status: hop.status,
      error: robotsUnavailable("redirect"),
    };
  }
  if (hop.reason === "html_not_robots") {
    return {
      action: "fail",
      host: hop.host,
      status: hop.status,
      reason: hop.reason,
      error: robotsUnavailable(500),
    };
  }
  if (hop.status >= 500) {
    return {
      action: "fail",
      host: hop.host,
      status: hop.status,
      error: robotsUnavailable(hop.status),
    };
  }
  return {
    action: "fail",
    host: hop.host,
    status: hop.status,
    error: robotsUnavailable(hop.status >= 400 ? hop.status : "network"),
  };
}

/**
 * Judiciary robots. Live fetches use the apex host only.
 * Wayback backfill may fall back to www after a 5xx or network error (Aaron, 2026-10-18).
 * 200 is obeyed, 404/410 allows, and 401/403/429 or a failed fallback fails closed.
 */
export async function loadJudiciaryRobotsPrefixes(
  userAgent: string,
  log?: RobotsDecisionLogger,
  opts: JudiciaryRobotsOptions = { allowFallback: false },
): Promise<string[]> {
  const primaryHop = await fetchRobotsUrl(JUDICIARY_ROBOTS_PRIMARY, userAgent);
  const primary = classifyRobotsHop(primaryHop);
  if (primary.action !== "fallback") return settleRobots(primary, log, { basis: "primary" });

  const primaryStatus = hopStatus(primaryHop);
  if (!opts.allowFallback) return settleRobots(failClosed(primaryHop), log, { basis: "primary" });

  const fallbackHop = await fetchRobotsUrl(JUDICIARY_ROBOTS_FALLBACK, userAgent);
  const fallback = classifyRobotsHop(fallbackHop);
  const meta: DecisionMeta = {
    basis: "fallback_host",
    primaryStatus,
    ...(primaryHop.kind === "done" && primaryHop.reason ? { primaryReason: primaryHop.reason } : {}),
  };
  if (fallback.action === "fallback") return settleRobots(failClosed(fallbackHop), log, meta);
  return settleRobots(fallback, log, meta);
}

async function fetchRobots(origin: string, userAgent: string): Promise<RobotsResponse> {
  const robotsUrl = `${origin.replace(/\/$/, "")}/robots.txt`;
  const res = await fetch(robotsUrl, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status >= 500) {
    throw new Error("robots.txt unavailable (5xx)");
  }
  return res;
}

export async function checkRobotsAllowsFetch(
  origin: string,
  userAgent: string,
  targetPath = "/dcl/",
): Promise<void> {
  const res = await fetchRobots(origin, userAgent);
  if (!res.ok) return;
  const text = await res.text();
  const prefixes = parseRobotsDisallowPrefixes(text);
  if (isPathDisallowedByRobots(targetPath, prefixes)) {
    throw new Error(`robots.txt disallows fetch for ${origin}${targetPath}`);
  }
}

/** Live DCL fetch: robots check uses the request URL pathname, not a default prefix. */
export async function assertLiveDclRobotsAllowed(
  liveUrl: string,
  userAgent: string,
  log?: RobotsDecisionLogger,
  opts: JudiciaryRobotsOptions = { allowFallback: false },
): Promise<void> {
  const url = new URL(liveUrl);
  const prefixes = await loadJudiciaryRobotsPrefixes(userAgent, log, opts);
  if (isPathDisallowedByRobots(url.pathname, prefixes)) {
    throw new Error(`robots.txt disallows fetch for ${url.origin}${url.pathname}`);
  }
}

/**
 * Live Judiciary robots always. Wayback mode also checks the archive host
 * against the snapshot pathname.
 */
export async function assertCauseListFetchAllowed(
  liveUrl: string,
  userAgent: string,
  waybackRequestUrl?: string,
  log?: RobotsDecisionLogger,
): Promise<void> {
  await assertLiveDclRobotsAllowed(liveUrl, userAgent, log, {
    allowFallback: Boolean(waybackRequestUrl),
  });
  if (!waybackRequestUrl) return;
  const archiveUrl = new URL(waybackRequestUrl);
  await checkRobotsAllowsFetch(archiveUrl.origin, userAgent, archiveUrl.pathname);
}

export async function loadRobotsDisallowPrefixes(
  origin: string,
  userAgent: string,
): Promise<string[]> {
  const res = await fetchRobots(origin, userAgent);
  if (!res.ok) return [];
  return parseRobotsDisallowPrefixes(await res.text());
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function retryWaitMs(
  res: { status: number; headers?: { get(name: string): string | null } },
  attempt: number,
): number {
  const fallback = RETRY_DELAYS_MS[attempt] ?? 20_000;
  if (res.status !== 429 && res.status !== 503) return fallback;
  const raw = res.headers?.get("retry-after");
  if (!raw) return fallback;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(seconds * 1000, fallback);
  }
  const when = Date.parse(raw);
  if (Number.isFinite(when)) return Math.max(when - Date.now(), fallback);
  return fallback;
}

export async function fetchDclHtml(
  url: string,
  options: FetchDclOptions,
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 20000;
  const maxRetries = options.maxRetries ?? 3;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": options.userAgent, Accept: "text/html" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return await res.text();
      const retryable = RETRY_STATUS.has(res.status) && attempt < maxRetries;
      if (!retryable) {
        throw new FetchFatal(`fetch failed ${res.status} ${url}`);
      }
      lastError = new Error(`fetch failed ${res.status}`);
      await sleep(retryWaitMs(res, attempt));
    } catch (e) {
      if (e instanceof FetchFatal) throw e;
      lastError = e;
      if (attempt === maxRetries) break;
      await sleep(RETRY_DELAYS_MS[attempt] ?? 20_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
