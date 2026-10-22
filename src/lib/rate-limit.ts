/** In-memory, per server instance. Not shared across processes. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
/** Caps memory on a long-lived instance; expired keys go first, then oldest. */
const MAX_KEYS = 10_000;

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    if (!entry && buckets.size >= MAX_KEYS) pruneBuckets(now);
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

function pruneBuckets(now: number): void {
  for (const [k, e] of buckets) {
    if (now > e.resetAt) buckets.delete(k);
  }
  for (const k of buckets.keys()) {
    if (buckets.size < MAX_KEYS) break;
    buckets.delete(k);
  }
}

export function rateLimitKeyCountForTests(): number {
  return buckets.size;
}

export function resetRateLimitForTests(): void {
  buckets.clear();
}
