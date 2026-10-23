import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemoryRateLimitForTests } from "@/lib/memory-rate-limit";
import { runQuoteAnalysis } from "@/lib/quote-analysis/run";
import type { QuoteStore } from "@/lib/quote-analysis/store";

const USER = "11111111-1111-4111-8111-111111111111";
const CLAIM = "33333333-3333-4333-8333-333333333333";
const env = {
  QUOTE_ANALYSIS_ENABLED: "1",
  AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
  AZURE_OPENAI_API_KEY: "test-not-a-key",
  AZURE_OPENAI_DEPLOYMENT: "quote-dep",
};
const PDF = new TextEncoder().encode("%PDF-1.4\n/Type /Page\n");

function harness(model?: () => Promise<unknown>) {
  const begin = vi.fn<QuoteStore["begin"]>(async () => ({ ok: true, claimId: CLAIM }));
  const finish = vi.fn<QuoteStore["finish"]>(async () => ({ analysisId: CLAIM }));
  const modelFn = vi.fn(
    model ??
      (async () => ({
        object: { isQuotation: true, items: [{ id: "demolition", status: "clear" }] },
        inputTokens: 1000,
        outputTokens: 100,
      })),
  );
  const run = (over: Partial<Parameters<typeof runQuoteAnalysis>[0]> = {}) =>
    runQuoteAnalysis({
      userId: USER,
      acknowledged: true,
      mediaType: "application/pdf",
      bytes: PDF,
      ip: "203.0.113.70",
      env,
      now: 1_000,
      model: modelFn as never,
      store: { begin, finish },
      ...over,
    });
  return { begin, finish, modelFn, run };
}

describe("runQuoteAnalysis", () => {
  beforeEach(() => resetMemoryRateLimitForTests());

  it("rejects an invalid PDF before reserving quota", async () => {
    const h = harness();
    const res = await h.run({ bytes: new TextEncoder().encode("not a pdf") });
    expect(res.status).toBe(400);
    expect(h.begin).not.toHaveBeenCalled();
    expect(h.modelFn).not.toHaveBeenCalled();
  });

  it("releases the reserve as failed with no actual cost when Azure throws", async () => {
    const h = harness(async () => {
      throw new Error("down");
    });
    const res = await h.run();
    expect(res.status).toBe(503);
    expect(h.finish).toHaveBeenCalledWith(
      expect.objectContaining({ claimId: CLAIM, outcome: "failed", actualMicroUsd: null, items: null }),
    );
  });

  it("books actual cost on an invalid model shape and stores nothing", async () => {
    const h = harness(async () => ({ object: { nope: 1 }, inputTokens: 1000, outputTokens: 0 }));
    const res = await h.run();
    expect(res.status).toBe(503);
    expect(h.finish).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed", actualMicroUsd: 100, items: null }),
    );
  });

  it("books actual cost when only one token count is known, null when none are", async () => {
    const one = harness(async () => ({
      object: { isQuotation: true, items: [] },
      inputTokens: null,
      outputTokens: 10,
    }));
    await one.run();
    expect(one.finish.mock.calls[0]?.[0].actualMicroUsd).toBe(5);
    resetMemoryRateLimitForTests();
    const none = harness(async () => ({
      object: { isQuotation: true, items: [] },
      inputTokens: null,
      outputTokens: null,
    }));
    await none.run();
    expect(none.finish.mock.calls[0]?.[0].actualMicroUsd).toBeNull();
  });

  it("fails closed when the result row was not written", async () => {
    const h = harness();
    h.finish.mockResolvedValue({ analysisId: null });
    const res = await h.run();
    expect(res.status).toBe(503);
    expect(res.body.id).toBeUndefined();
  });

  it("rate limits per address and per account", async () => {
    const h = harness();
    for (let i = 0; i < 5; i += 1) {
      expect((await h.run({ userId: `user-${i}` })).status).toBe(200);
    }
    expect((await h.run({ userId: "user-9" })).status).toBe(429);
    resetMemoryRateLimitForTests();
    for (let i = 0; i < 5; i += 1) {
      expect((await h.run({ ip: `198.51.100.${i}` })).status).toBe(200);
    }
    expect((await h.run({ ip: "198.51.100.99" })).status).toBe(429);
  });
});
