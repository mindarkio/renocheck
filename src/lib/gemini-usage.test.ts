import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  geminiCountingFetch,
  getGeminiUsageSnapshot,
  nextPacificReset,
  pacificDayStart,
  resetGeminiUsageForTests,
} from "./gemini-usage";

const MODEL_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=super-secret-key-value";

function quotaBody(quotaId: string, quotaValue = "4", retryDelay = "29s") {
  return {
    error: {
      code: 429,
      status: "RESOURCE_EXHAUSTED",
      message: "You exceeded your current quota",
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.QuotaFailure",
          violations: [
            {
              quotaMetric:
                "generativelanguage.googleapis.com/generate_content_free_tier_requests",
              quotaId,
              quotaValue,
            },
          ],
        },
        {
          "@type": "type.googleapis.com/google.rpc.RetryInfo",
          retryDelay,
        },
      ],
    },
  };
}

function hktHour(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

describe("pacific day boundary", () => {
  it("resets at 15:00 HKT before the 2026-11-01 DST switch and 16:00 after", () => {
    const before = new Date("2026-10-31T18:00:00.000Z");
    const beforeReset = nextPacificReset(before);
    expect(beforeReset.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(hktHour(beforeReset)).toBe("15:00");
    expect(pacificDayStart(before).toISOString()).toBe("2026-10-31T07:00:00.000Z");

    const after = new Date("2026-11-01T10:00:00.000Z");
    const afterReset = nextPacificReset(after);
    expect(afterReset.toISOString()).toBe("2026-11-02T08:00:00.000Z");
    expect(hktHour(afterReset)).toBe("16:00");
    expect(pacificDayStart(after).toISOString()).toBe("2026-11-01T07:00:00.000Z");
  });
});

describe("geminiCountingFetch", () => {
  beforeEach(() => {
    resetGeminiUsageForTests();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetGeminiUsageForTests();
  });

  async function respond(res: Response) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res),
    );
    return geminiCountingFetch(MODEL_URL, {
      method: "POST",
      headers: { "x-goog-api-key": "another-secret-header-value" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "prompt-secret" }] }] }),
    });
  }

  it("maps a PerDay quotaId to quota_day and passes the response through", async () => {
    const payload = quotaBody(
      "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
      "20",
    );
    const res = new Response(JSON.stringify(payload), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await respond(res);

    expect(out).toBe(res);
    expect(await out.json()).toEqual(payload);
    const snap = getGeminiUsageSnapshot(Date.now());
    expect(snap.records).toHaveLength(1);
    expect(snap.records[0]).toMatchObject({
      model: "gemini-3.5-flash",
      outcome: "quota_day",
      quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
      quotaValue: 20,
      retryDelayS: 29,
    });
    const logged = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain('"event":"gemini_http"');
    expect(logged).toContain('"outcome":"quota_day"');
    expect(logged).not.toContain("super-secret-key-value");
    expect(logged).not.toContain("another-secret-header-value");
    expect(logged).not.toContain("prompt-secret");
    expect(JSON.stringify(snap)).not.toContain("super-secret-key-value");
    expect(JSON.stringify(snap)).not.toContain("another-secret-header-value");
  });

  it("maps a PerMinute quotaId to rate_minute", async () => {
    const res = new Response(
      JSON.stringify(
        quotaBody("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "5", "12s"),
      ),
      { status: 429 },
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await respond(res);
    expect(getGeminiUsageSnapshot().records[0]).toMatchObject({
      outcome: "rate_minute",
      quotaValue: 5,
      retryDelayS: 12,
    });
  });

  it("prefers PerDay when both violations are present", async () => {
    const body = quotaBody("GenerateRequestsPerMinutePerProjectPerModel-FreeTier");
    const details = (body.error.details[0] as { violations: { quotaId: string }[] })
      .violations;
    details.push({
      quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
      quotaValue: "4",
    } as { quotaId: string });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await respond(new Response(JSON.stringify(body), { status: 429 }));
    expect(getGeminiUsageSnapshot().records[0]?.outcome).toBe("quota_day");
  });

  it("does not throw on a malformed or non-JSON 429 and still returns that response", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const malformed = new Response("{", { status: 429 });
    const out = await respond(malformed);
    expect(out).toBe(malformed);
    expect(await out.text()).toBe("{");
    expect(getGeminiUsageSnapshot().records[0]?.outcome).toBe("rate_other");

    resetGeminiUsageForTests();
    const weird = new Response(JSON.stringify({ error: { details: "nope" } }), {
      status: 429,
    });
    const out2 = await respond(weird);
    expect(out2).toBe(weird);
    expect(getGeminiUsageSnapshot().records[0]?.outcome).toBe("rate_other");
  });

  it("counts each fetch, including retries, and does not log successes", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    await geminiCountingFetch(MODEL_URL);
    await geminiCountingFetch(MODEL_URL);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("busy", { status: 503 })),
    );
    await geminiCountingFetch(MODEL_URL);
    const snap = getGeminiUsageSnapshot();
    expect(snap.instanceCalls).toBe(3);
    expect(snap.counts24h.ok).toBe(2);
    expect(snap.counts24h.server_5xx).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(info).not.toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("super-secret-key-value");
  });

  it("records network failures and rethrows the original error", async () => {
    const boom = new Error("socket down");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw boom;
      }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(geminiCountingFetch(MODEL_URL)).rejects.toBe(boom);
    expect(getGeminiUsageSnapshot().records[0]?.outcome).toBe("network");
  });

  it("parses the model id from the path of a Request and drops records older than 24h", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = new Request(MODEL_URL, { method: "POST" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    await geminiCountingFetch(req);
    expect(getGeminiUsageSnapshot().records[0]?.model).toBe("gemini-3.5-flash");

    vi.setSystemTime(new Date("2026-06-16T12:00:00.001Z"));
    const snap = getGeminiUsageSnapshot(Date.now());
    expect(snap.records).toHaveLength(0);
    expect(snap.instanceCalls).toBe(0);
  });

  it("keeps at most 500 attempts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    for (let i = 0; i < 501; i++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 5, 15, 12, 0, i)));
      await geminiCountingFetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      );
    }
    expect(getGeminiUsageSnapshot().records).toHaveLength(500);
  });

  it("does not seed the overflow fixture in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OVERFLOW_CHECK_GEMINI", "1");
    const snap = getGeminiUsageSnapshot(Date.parse("2026-06-15T12:00:00.000Z"));
    expect(snap.records).toHaveLength(0);
    expect(snap.counts24h.quota_day).toBe(0);
    vi.unstubAllEnvs();
  });

  it("seeds one quota_day outside production when the overflow flag is set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OVERFLOW_CHECK_GEMINI", "1");
    const now = Date.parse("2026-06-15T12:00:00.000Z");
    const snap = getGeminiUsageSnapshot(now);
    expect(snap.counts24h.quota_day).toBe(1);
    expect(snap.instanceCalls).toBe(1);
    expect(getGeminiUsageSnapshot(now).records).toHaveLength(1);
    vi.unstubAllEnvs();
  });
});
