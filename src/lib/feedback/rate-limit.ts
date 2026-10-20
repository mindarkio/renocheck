const WINDOW_MS = 60_000;
const DEFAULT_MAX = 10;
const MAX_BUCKETS = 5_000;

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

function pruneExpired(now: number): void {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt < now) buckets.delete(key);
  }
}

/** In-memory limit per key. Default 10 per minute. Prunes expired keys past 5,000 entries. */
export function checkFeedbackRateLimit(
  key: string,
  now = Date.now(),
  max = DEFAULT_MAX,
): boolean {
  pruneExpired(now);
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

export function feedbackRateLimitSizeForTests(): number {
  return buckets.size;
}

export function resetFeedbackRateLimitForTests(): void {
  buckets.clear();
}
