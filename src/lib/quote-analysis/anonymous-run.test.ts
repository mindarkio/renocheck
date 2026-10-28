import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemoryRateLimitForTests } from "@/lib/memory-rate-limit";
import { reserveExtractionMicroUsd } from "@/lib/quote-analysis/config";

vi.mock("@/lib/quote-analysis/anon-budget", () => ({
  takeAnonymousQuoteSlot: vi.fn(async () => "ok"),
  reserveAnonymousQuoteSpend: vi.fn(async () => ({ day: "2026-10-28", reserve: 5_000 })),
  settleAnonymousQuoteSpend: vi.fn(async () => {}),
}));

import {
  reserveAnonymousQuoteSpend,
  settleAnonymousQuoteSpend,
  takeAnonymousQuoteSlot,
} from "@/lib/quote-analysis/anon-budget";
import { runAnonymousQuoteAnalysis } from "./anonymous-run";

const NAME = "合成測試工程有限公司";
const env = {
  QUOTE_ANALYSIS_ENABLED: "1",
  AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
  AZURE_OPENAI_API_KEY: "test-not-a-key",
  AZURE_OPENAI_DEPLOYMENT: "quote-dep",
};
const PDF = new TextEncoder().encode("%PDF-1.4\n/Type /Page\n");

describe("runAnonymousQuoteAnalysis", () => {
  beforeEach(() => {
    resetMemoryRateLimitForTests();
    vi.mocked(takeAnonymousQuoteSlot).mockResolvedValue("ok");
    vi.mocked(reserveAnonymousQuoteSpend).mockResolvedValue({ day: "2026-10-28", reserve: 5_000 });
    vi.mocked(settleAnonymousQuoteSpend).mockClear();
    vi.mocked(reserveAnonymousQuoteSpend).mockClear();
  });

  it("returns only the company name and reserves the extraction cost", async () => {
    const result = await runAnonymousQuoteAnalysis({
      acknowledged: true,
      mediaType: "application/pdf",
      bytes: PDF,
      ip: "203.0.113.10",
      env,
      now: 1_000,
      model: async () => ({
        object: { companyName: `  ${NAME}  ` },
        inputTokens: 1_000,
        outputTokens: 8,
      }),
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ companyName: NAME });
    expect(result.body).not.toHaveProperty("items");
    expect(result.body).not.toHaveProperty("id");
    expect(reserveAnonymousQuoteSpend).toHaveBeenCalledWith(reserveExtractionMicroUsd(1), env);
    expect(settleAnonymousQuoteSpend).toHaveBeenCalledTimes(1);
  });

  it("returns null when the model finds no company name", async () => {
    const result = await runAnonymousQuoteAnalysis({
      acknowledged: true,
      mediaType: "application/pdf",
      bytes: PDF,
      ip: "203.0.113.16",
      env,
      now: 1_500,
      model: async () => ({
        object: { companyName: null },
        inputTokens: 10,
        outputTokens: 2,
      }),
    });
    expect(result.status).toBe(200);
    expect(result.body.companyName).toBeNull();
  });

  it("stops when the anonymous IP allowance or the budget is closed", async () => {
    vi.mocked(takeAnonymousQuoteSlot).mockResolvedValue("limited");
    const limited = await runAnonymousQuoteAnalysis({
      acknowledged: true,
      mediaType: "application/pdf",
      bytes: PDF,
      ip: "203.0.113.11",
      env,
      now: 2_000,
      model: async () => {
        throw new Error("should not run");
      },
    });
    expect(limited.status).toBe(429);
    expect(limited.body.companyName).toBeUndefined();

    resetMemoryRateLimitForTests();
    vi.mocked(takeAnonymousQuoteSlot).mockResolvedValue("ok");
    vi.mocked(reserveAnonymousQuoteSpend).mockResolvedValue("budget");
    const paused = await runAnonymousQuoteAnalysis({
      acknowledged: true,
      mediaType: "application/pdf",
      bytes: PDF,
      ip: "203.0.113.12",
      env,
      now: 3_000,
      model: async () => {
        throw new Error("should not run");
      },
    });
    expect(paused.status).toBe(503);
    expect(paused.body.error).toBe("quote_paused");
    expect(settleAnonymousQuoteSpend).not.toHaveBeenCalled();
  });

  it("settles the hold once for every provider call", async () => {
    const base = {
      acknowledged: true,
      mediaType: "application/pdf",
      bytes: PDF,
      env,
    };
    const ok = await runAnonymousQuoteAnalysis({
      ...base,
      ip: "203.0.113.20",
      now: 5_000,
      model: async () => ({
        object: { companyName: NAME },
        inputTokens: 1_000_000,
        outputTokens: 0,
      }),
    });
    expect(ok.status).toBe(200);
    expect(settleAnonymousQuoteSpend).toHaveBeenLastCalledWith(
      { day: "2026-10-28", reserve: 5_000 },
      100_000,
    );

    const thrown = await runAnonymousQuoteAnalysis({
      ...base,
      ip: "203.0.113.21",
      now: 6_000,
      model: async () => {
        throw new Error("provider down");
      },
    });
    expect(thrown.status).toBe(503);
    expect(settleAnonymousQuoteSpend).toHaveBeenLastCalledWith(
      { day: "2026-10-28", reserve: 5_000 },
      null,
    );
    expect(settleAnonymousQuoteSpend).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the hold cannot be taken", async () => {
    vi.mocked(reserveAnonymousQuoteSpend).mockResolvedValue("unavailable");
    const result = await runAnonymousQuoteAnalysis({
      acknowledged: true,
      mediaType: "application/pdf",
      bytes: PDF,
      ip: "203.0.113.23",
      env,
      now: 8_000,
      model: async () => {
        throw new Error("should not run");
      },
    });
    expect(result.status).toBe(503);
    expect(result.body.error).toBe("quote_unavailable");
    expect(settleAnonymousQuoteSpend).not.toHaveBeenCalled();
  });
});
