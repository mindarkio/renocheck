import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isQuoteAnalysisAvailable,
} from "@/lib/quote-analysis/config";
import { quoteAnalysisUserFacingCopy } from "@/lib/quote-analysis/copy";
import {
  REPORT_TRUST_FORBIDDEN_ZH,
  REPORT_TRUST_NEGATED_ALLOWLIST_ZH,
} from "@/lib/report-trust-copy-zh";

describe("quote analysis copy and flag", () => {
  it("stays off unless the flag and all Azure env vars are set", () => {
    expect(isQuoteAnalysisAvailable({})).toBe(false);
    expect(
      isQuoteAnalysisAvailable({
        QUOTE_ANALYSIS_ENABLED: "1",
        AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
        AZURE_OPENAI_DEPLOYMENT: "quote-gpt-6-luna",
      }),
    ).toBe(false);
    expect(
      isQuoteAnalysisAvailable({
        QUOTE_ANALYSIS_ENABLED: "1",
        AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
        AZURE_OPENAI_API_KEY: "test-not-a-key",
        AZURE_OPENAI_DEPLOYMENT: "quote-gpt-6-luna",
      }),
    ).toBe(true);
  });

  it("keeps new copy clear of report-trust forbidden words", () => {
    for (const text of quoteAnalysisUserFacingCopy()) {
      let remaining = text;
      for (const ok of REPORT_TRUST_NEGATED_ALLOWLIST_ZH) {
        remaining = remaining.split(ok).join("");
      }
      for (const word of REPORT_TRUST_FORBIDDEN_ZH) {
        expect(remaining).not.toContain(word);
      }
    }
  });

  it("does not let quote analysis share the company-report model", () => {
    const llm = readFileSync("src/lib/llm-model.ts", "utf8");
    const provider = readFileSync("src/lib/quote-analysis/provider.ts", "utf8");
    expect(llm).not.toContain("@ai-sdk/azure");
    expect(llm).not.toContain("AZURE_OPENAI");
    expect(provider).not.toContain("llm-model");
    expect(provider).not.toContain("@ai-sdk/google");
    expect(provider).not.toContain("@ai-sdk/gateway");
    expect(provider).not.toContain("@ai-sdk/openai");
  });
});
