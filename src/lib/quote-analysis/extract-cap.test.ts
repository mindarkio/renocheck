import { afterEach, describe, expect, it, vi } from "vitest";
import { QUOTE_EXTRACT_MAX_OUTPUT_TOKENS, reserveExtractionMicroUsd, microUsdFromTokens } from "@/lib/quote-analysis/config";
import { extractQuoteCompanyName } from "@/lib/quote-analysis/provider";

const env = {
  QUOTE_ANALYSIS_ENABLED: "1",
  AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
  AZURE_OPENAI_API_KEY: "test-not-a-key",
  AZURE_OPENAI_DEPLOYMENT: "quote-gpt-6-luna",
};

describe("logged-out extraction output cap", () => {
  afterEach(() => {
    globalThis.AI_SDK_LOG_WARNINGS = undefined;
    vi.unstubAllGlobals();
  });

  it("leaves room for reasoning tokens, which count toward the cap", () => {
    expect(QUOTE_EXTRACT_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(1_000);
    expect(reserveExtractionMicroUsd(1)).toBe(microUsdFromTokens(400 + 3_800, QUOTE_EXTRACT_MAX_OUTPUT_TOKENS));
  });

  it("sends the cap and the reasoning effort in the request body", async () => {
    globalThis.AI_SDK_LOG_WARNINGS = false;
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const raw = init?.body;
      bodies.push(typeof raw === "string" ? raw : raw instanceof Uint8Array ? new TextDecoder().decode(raw) : "");
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }));
    await expect(extractQuoteCompanyName(new TextEncoder().encode("%PDF-1.4\n"), env)).rejects.toThrow();
    const parsed = JSON.parse(bodies[0] ?? "{}") as { max_output_tokens?: number; reasoning?: { effort?: string } };
    expect(parsed.max_output_tokens).toBe(QUOTE_EXTRACT_MAX_OUTPUT_TOKENS);
    expect(parsed.reasoning).toEqual({ effort: "low" });
  });
});
