const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [5000, 10000, 20000];

export type FetchDclOptions = {
  userAgent: string;
  timeoutMs?: number;
  maxRetries?: number;
};

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

export async function checkRobotsAllowsFetch(
  origin: string,
  userAgent: string,
  targetPath = "/dcl/",
): Promise<void> {
  const robotsUrl = `${origin.replace(/\/$/, "")}/robots.txt`;
  const res = await fetch(robotsUrl, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(15000),
  });
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

export async function loadRobotsDisallowPrefixes(
  origin: string,
  userAgent: string,
): Promise<string[]> {
  const robotsUrl = `${origin.replace(/\/$/, "")}/robots.txt`;
  const res = await fetch(robotsUrl, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  return parseRobotsDisallowPrefixes(await res.text());
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
      if (!RETRY_STATUS.has(res.status) || attempt === maxRetries) {
        throw new Error(`fetch failed ${res.status} ${url}`);
      }
      lastError = new Error(`fetch failed ${res.status}`);
    } catch (e) {
      lastError = e;
      if (attempt === maxRetries) break;
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt] ?? 20000));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
