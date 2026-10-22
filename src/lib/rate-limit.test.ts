import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  rateLimitKeyCountForTests,
  resetRateLimitForTests,
} from "./rate-limit";

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

  it("keeps at most 10,000 keys and still limits the newest key", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    for (let i = 0; i < 10_050; i++) checkRateLimit(`k${i}`);
    expect(rateLimitKeyCountForTests()).toBeLessThanOrEqual(10_000);
    for (let i = 0; i < 4; i++) expect(checkRateLimit("k10049")).toBe(true);
    expect(checkRateLimit("k10049")).toBe(false);
  });

  it("drops expired keys first when full", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    for (let i = 0; i < 10_000; i++) checkRateLimit(`old${i}`);
    vi.setSystemTime(new Date("2026-06-01T00:00:30.000Z"));
    for (let i = 0; i < 5; i++) checkRateLimit("fresh");
    vi.setSystemTime(new Date("2026-06-01T00:01:00.001Z"));
    checkRateLimit("new");
    expect(rateLimitKeyCountForTests()).toBe(2);
    expect(checkRateLimit("fresh")).toBe(false);
  });
});
