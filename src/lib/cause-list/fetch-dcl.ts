const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [5000, 10000, 20000];

export type FetchDclOptions = {
  userAgent: string;
  timeoutMs?: number;
  maxRetries?: number;
};

export async function checkRobotsAllowsFetch(
  origin: string,
  userAgent: string,
): Promise<void> {
  const robotsUrl = `${origin.replace(/\/$/, "")}/robots.txt`;
  const res = await fetch(robotsUrl, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return;
  const text = await res.text();
  const lines = text.split(/\r?\n/);
  let applies = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^user-agent:\s*\*/i.test(trimmed)) applies = true;
    if (/^user-agent:/i.test(trimmed) && !/\*/i.test(trimmed)) applies = false;
    if (applies && /^disallow:\s*\/\s*$/i.test(trimmed)) {
      throw new Error(`robots.txt disallows fetch for ${origin}`);
    }
  }
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
