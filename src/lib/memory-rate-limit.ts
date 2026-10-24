const MAX_BUCKETS = 5_000;

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

function pruneExpired(now: number): void {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, entry] of buckets) {
    if (entry.resetAt < now) buckets.delete(key);
  }
}

/** In-memory allowance. Returns true when the call may proceed. */
export function takeMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  pruneExpired(now);
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function resetMemoryRateLimitForTests(): void {
  buckets.clear();
}
