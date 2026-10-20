const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

/** 10 requests per minute per key. In-memory, per instance. */
export function checkFeedbackRateLimit(key: string, now = Date.now()): boolean {
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

export function resetFeedbackRateLimitForTests(): void {
  buckets.clear();
}
