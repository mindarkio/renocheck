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
): Promise<void> {
  const url = new URL(liveUrl);
  await checkRobotsAllowsFetch(url.origin, userAgent, url.pathname);
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
