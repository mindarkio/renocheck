import { FetchFatal } from "../bd-register/fetch-csv";

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

const JUDICIARY_ROBOTS_PRIMARY = "https://e-services.judiciary.hk/robots.txt";
const JUDICIARY_ROBOTS_FALLBACK = "https://www.e-services.judiciary.hk/robots.txt";
const MAX_ROBOTS_REDIRECTS = 3;
const HK_SECOND_LEVEL_PUBLIC = new Set(["com", "edu", "gov", "idv", "info", "net", "org"]);

export type RobotsDecisionLogger = (
  event: Record<string, string | number>,
) => void;

/** eTLD+1. Multi-label .hk suffixes stay intact; other hosts use the last two labels. */
function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  if (tld === "hk" && second && HK_SECOND_LEVEL_PUBLIC.has(second)) {
    return labels.slice(-3).join(".");
  }
  return labels.slice(-2).join(".");
}

type RobotsHop =
  | { kind: "done"; status: number; body: string; host: string }
  | { kind: "network" }
  | { kind: "bad_redirect"; status: number; host: string };

async function fetchRobotsUrl(startUrl: string, userAgent: string): Promise<RobotsHop> {
  let current = startUrl;
  const root = registrableDomain(new URL(startUrl).hostname);
  for (let redirects = 0; ; redirects++) {
    let res: Response;
    try {
      res = await fetch(current, {
        headers: { "User-Agent": userAgent },
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return { kind: "network" };
    }
    const host = new URL(current).hostname;
    if (res.status >= 300 && res.status < 400) {
      if (redirects >= MAX_ROBOTS_REDIRECTS) {
        return { kind: "bad_redirect", status: res.status, host };
      }
      const location = res.headers.get("location");
      let next: URL;
      try {
        next = new URL(location ?? "", current);
      } catch {
        return { kind: "bad_redirect", status: res.status, host };
      }
      if (
        !location ||
        next.protocol !== "https:" ||
        registrableDomain(next.hostname) !== root
      ) {
        return { kind: "bad_redirect", status: res.status, host };
      }
      current = next.toString();
      continue;
    }
    const body = res.status === 200 ? await res.text() : "";
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
  | { action: "prefixes"; prefixes: string[]; host: string; status: number }
  | { action: "allow"; host: string; status: number }
  | { action: "fallback" }
  | { action: "fail"; host: string; status: number; error: Error };

function classifyRobotsHop(hop: RobotsHop): RobotsClass {
  if (hop.kind === "network") return { action: "fallback" };
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

function settleRobots(classified: RobotsClass, log?: RobotsDecisionLogger): string[] {
  if (classified.action === "prefixes") {
    log?.({
      event: "robots_decision",
      host: classified.host,
      status: classified.status,
      result: "parsed",
    });
    return classified.prefixes;
  }
  if (classified.action === "allow") {
    log?.({
      event: "robots_decision",
      host: classified.host,
      status: classified.status,
      result: "allow",
    });
    return [];
  }
  if (classified.action === "fail") {
    log?.({
      event: "robots_decision",
      host: classified.host,
      status: classified.status,
      result: "fail_closed",
    });
    throw classified.error;
  }
  throw robotsUnavailable("network");
}

/**
 * Judiciary robots. The apex host often returns 502; the www host is the fallback.
 * 200 is obeyed, 404/410 allows, and 401/403/429 or a failed fallback fails closed.
 */
export async function loadJudiciaryRobotsPrefixes(
  userAgent: string,
  log?: RobotsDecisionLogger,
): Promise<string[]> {
  const primaryHop = await fetchRobotsUrl(JUDICIARY_ROBOTS_PRIMARY, userAgent);
  const primary = classifyRobotsHop(primaryHop);
  if (primary.action !== "fallback") return settleRobots(primary, log);

  const fallbackHop = await fetchRobotsUrl(JUDICIARY_ROBOTS_FALLBACK, userAgent);
  const fallback = classifyRobotsHop(fallbackHop);
  if (fallback.action === "fallback") {
    const host =
      fallbackHop.kind === "network" ? "www.e-services.judiciary.hk" : fallbackHop.host;
    const status = fallbackHop.kind === "done" ? fallbackHop.status : 0;
    log?.({ event: "robots_decision", host, status, result: "fail_closed" });
    throw fallbackHop.kind === "done" && fallbackHop.status >= 500
      ? robotsUnavailable(fallbackHop.status)
      : robotsUnavailable("network");
  }
  return settleRobots(fallback, log);
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
): Promise<void> {
  const url = new URL(liveUrl);
  const prefixes = await loadJudiciaryRobotsPrefixes(userAgent, log);
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
): Promise<void> {
  await assertLiveDclRobotsAllowed(liveUrl, userAgent);
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
