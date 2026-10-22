import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimitForTests } from "./rate-limit";

describe("search rate limit", () => {
  beforeEach(() => {
    resetRateLimitForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitForTests();
  });

  it("allows 5 requests per key per minute on this instance, then rejects", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    const key = "198.51.100.20";

    for (let i = 0; i < 5; i++) expect(checkRateLimit(key)).toBe(true);
    expect(checkRateLimit(key)).toBe(false);

    vi.setSystemTime(new Date("2026-06-01T00:01:00.001Z"));
    expect(checkRateLimit(key)).toBe(true);
  });
});
