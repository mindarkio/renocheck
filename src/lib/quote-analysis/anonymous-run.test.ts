import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemoryRateLimitForTests } from "@/lib/memory-rate-limit";

vi.mock("@/lib/quote-analysis/anon-budget", () => ({
  takeAnonymousQuoteSlot: vi.fn(async () => "ok"),
  anonymousBudgetAllows: vi.fn(async () => "ok"),
  noteAnonymousSpend: vi.fn(async () => {}),
}));

import {
  anonymousBudgetAllows,
  takeAnonymousQuoteSlot,
} from "@/lib/quote-analysis/anon-budget";
import { runAnonymousQuoteAnalysis } from "./anonymous-run";
import { openQuoteResult } from "./seal";

const NAME = "合成測試工程有限公司";
const env = {
  QUOTE_ANALYSIS_ENABLED: "1",
  AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
  AZURE_OPENAI_API_KEY: "test-not-a-key",
  AZURE_OPENAI_DEPLOYMENT: "quote-dep",
  QUOTE_RESULT_SEAL_SECRET: "k".repeat(32),
};
const PDF = new TextEncoder().encode("%PDF-1.4\n/Type /Page\n");

describe("runAnonymousQuoteAnalysis", () => {
  beforeEach(() => {
    resetMemoryRateLimitForTests();
    vi.mocked(takeAnonymousQuoteSlot).mockResolvedValue("ok");
    vi.mocked(anonymousBudgetAllows).mockResolvedValue("ok");
  });

  it("returns a sealed blob and no report fields", async () => {
    const result = await runAnonymousQuoteAnalysis({
      acknowledged: true,
      mediaType: "application/pdf",
      bytes: PDF,
      ip: "203.0.113.10",
      env,
      now: 1_000,
      model: async () => ({
        object: {
          isQuotation: true,
          companyName: NAME,
          items: [{ id: "demolition", status: "clear" }],
        },
        inputTokens: 20,
        outputTokens: 5,
      }),
    });
    expect(result.status).toBe(200);
    expect(result.body.sealed).toBeTypeOf("string");
    expect(JSON.stringify(result.body)).not.toContain(NAME);
    expect(result.body).not.toHaveProperty("items");
    expect(result.body).not.toHaveProperty("companyName");
    expect(result.body).not.toHaveProperty("id");
    expect(openQuoteResult(result.body.sealed!, env, 1_000).companyName).toBe(NAME);
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
    expect(limited.body.sealed).toBeUndefined();

    resetMemoryRateLimitForTests();
    vi.mocked(takeAnonymousQuoteSlot).mockResolvedValue("ok");
    vi.mocked(anonymousBudgetAllows).mockResolvedValue("budget");
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
  });

  it("requires sign-in when the seal secret is missing", async () => {
    const result = await runAnonymousQuoteAnalysis({
      acknowledged: true,
      mediaType: "application/pdf",
      bytes: PDF,
      ip: "203.0.113.13",
      env: { ...env, QUOTE_RESULT_SEAL_SECRET: "" },
      now: 4_000,
      model: async () => {
        throw new Error("should not run");
      },
    });
    expect(result.status).toBe(401);
    expect(result.body.error).toBe("auth_required");
  });
});
