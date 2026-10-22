import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiCountingFetch, resetGeminiUsageForTests } from "./gemini-usage";
import {
  getServiceStatus,
  resetServiceStatusForTests,
} from "./service-status";

const URL_NO_QUERY =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

function minuteBody(retryDelay = "29s") {
  return JSON.stringify({
    error: {
      code: 429,
      status: "RESOURCE_EXHAUSTED",
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.QuotaFailure",
          violations: [
            {
              quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier",
              quotaValue: "4",
            },
          ],
        },
        {
          "@type": "type.googleapis.com/google.rpc.RetryInfo",
          retryDelay,
        },
      ],
    },
  });
}

function dayBody() {
  return JSON.stringify({
    error: {
      code: 429,
      status: "RESOURCE_EXHAUSTED",
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.QuotaFailure",
          violations: [
            {
              quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
              quotaValue: "4",
            },
          ],
        },
      ],
    },
  });
}

describe("service status breaker", () => {
  beforeEach(() => {
    resetGeminiUsageForTests();
    resetServiceStatusForTests();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetGeminiUsageForTests();
    resetServiceStatusForTests();
  });

  async function hit(status: number, body = "") {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { status })),
    );
    await geminiCountingFetch(URL_NO_QUERY);
  }

  it("keeps a daily quota open until the next Pacific midnight", async () => {
    vi.setSystemTime(new Date("2026-10-31T18:00:00.000Z"));
    await hit(429, dayBody());
    expect(getServiceStatus(Date.now())).toEqual({
      paused: true,
      reason: "gemini_quota_day",
    });
    expect(getServiceStatus(new Date("2026-11-01T06:59:59.000Z"))).toEqual({
      paused: true,
      reason: "gemini_quota_day",
    });
    expect(getServiceStatus(new Date("2026-11-01T07:00:00.000Z"))).toEqual({
      paused: false,
      reason: null,
    });
  });

  it("opens after 3 errors in 5 minutes and clears after the cooldown", async () => {
    const t0 = Date.parse("2026-06-01T00:00:00.000Z");
    vi.setSystemTime(t0);
    await hit(503);
    vi.setSystemTime(t0 + 60_000);
    await hit(503);
    vi.setSystemTime(t0 + 120_000);
    await hit(500);
    expect(getServiceStatus(t0 + 120_000)).toEqual({
      paused: true,
      reason: "gemini_errors",
    });
    expect(getServiceStatus(t0 + 120_000 + 119_000).paused).toBe(true);
    expect(getServiceStatus(t0 + 120_000 + 120_000)).toEqual({
      paused: false,
      reason: null,
    });
  });

  it("uses retryDelay when it is longer than 120 seconds", async () => {
    const t0 = Date.parse("2026-06-01T00:00:00.000Z");
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(t0 + i * 1000);
      await hit(429, minuteBody("180s"));
    }
    expect(getServiceStatus(t0 + 2000 + 179_000).paused).toBe(true);
    expect(getServiceStatus(t0 + 2000 + 180_000).paused).toBe(false);
  });

  it("lets an ok response reset the error streak", async () => {
    const t0 = Date.parse("2026-06-01T00:00:00.000Z");
    vi.setSystemTime(t0);
    await hit(503);
    vi.setSystemTime(t0 + 1000);
    await hit(503);
    vi.setSystemTime(t0 + 2000);
    await hit(200, "{}");
    vi.setSystemTime(t0 + 3000);
    await hit(503);
    vi.setSystemTime(t0 + 4000);
    await hit(503);
    expect(getServiceStatus(t0 + 4000)).toEqual({ paused: false, reason: null });
  });

  it("does not count other 429s toward the streak", async () => {
    const t0 = Date.parse("2026-06-01T00:00:00.000Z");
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(t0 + i * 1000);
      await hit(429, JSON.stringify({ error: { code: 429 } }));
    }
    expect(getServiceStatus(t0).paused).toBe(false);
  });

  it("pauses when SERVICE_PAUSED=1", () => {
    vi.stubEnv("SERVICE_PAUSED", "1");
    expect(getServiceStatus()).toEqual({ paused: true, reason: "manual" });
    vi.stubEnv("SERVICE_PAUSED", "");
    expect(getServiceStatus()).toEqual({ paused: false, reason: null });
  });
});
