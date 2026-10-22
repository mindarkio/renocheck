/** In-memory, per server instance. Not shared across processes. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

export function resetRateLimitForTests(): void {
  buckets.clear();
}
