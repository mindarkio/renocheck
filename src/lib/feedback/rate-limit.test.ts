import { afterEach, describe, expect, it } from "vitest";
import {
  checkFeedbackRateLimit,
  feedbackRateLimitSizeForTests,
  resetFeedbackRateLimitForTests,
} from "./rate-limit";

afterEach(() => {
  resetFeedbackRateLimitForTests();
});

describe("feedback rate limit", () => {
  it("prunes expired keys once the map grows past 5000", () => {
    for (let i = 0; i < 5001; i += 1) {
      expect(checkFeedbackRateLimit(`old-${i}`, 0)).toBe(true);
    }
    expect(feedbackRateLimitSizeForTests()).toBe(5001);
    expect(checkFeedbackRateLimit("fresh", 60_001)).toBe(true);
    expect(feedbackRateLimitSizeForTests()).toBe(1);
  });
});
