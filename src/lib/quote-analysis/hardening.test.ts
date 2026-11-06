import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isQuoteAnalysisAvailable,
  isQuoteAnalysisFlagOn,
  microUsdFromTokens,
  quoteDailyBudgetMicroUsd,
} from "@/lib/quote-analysis/config";

const AZURE = {
  QUOTE_ANALYSIS_ENABLED: "1",
  AZURE_OPENAI_API_KEY: "test-not-a-key",
  AZURE_OPENAI_DEPLOYMENT: "quote-dep",
};

describe("quote analysis hardening", () => {
  it("only turns on for explicit flag values and https endpoints", () => {
    for (const value of ["0", "no", "off", "false", ""]) {
      expect(isQuoteAnalysisFlagOn({ QUOTE_ANALYSIS_ENABLED: value })).toBe(false);
    }
    expect(
      isQuoteAnalysisAvailable({ ...AZURE, AZURE_OPENAI_ENDPOINT: "http://quote.example.invalid" }),
    ).toBe(false);
  });

  it("falls back to the default budget for negative values and rounds cost up", () => {
    expect(quoteDailyBudgetMicroUsd({ QUOTE_DAILY_BUDGET_USD: "-1" })).toBe(1_000_000);
    expect(quoteDailyBudgetMicroUsd({ QUOTE_DAILY_BUDGET_USD: "0" })).toBe(0);
    expect(microUsdFromTokens(1, 0)).toBe(1);
  });

  it("sends private, noindex headers on every signed-in surface", async () => {
    const { default: nextConfig } = await import("../../../next.config");
    const headers = (await nextConfig.headers?.()) ?? [];
    for (const source of [
      "/quote/analyses/:path*",
      "/account",
      "/account/:path*",
      "/login",
      "/quote/upload",
      "/api/auth/:path*",
      "/api/quote/:path*",
    ]) {
      const entry = headers.find((h) => h.source === source);
      expect(entry?.headers).toEqual(
        expect.arrayContaining([
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ]),
      );
    }
  });

  it("releases stale claims only on the locked HK day", () => {
    const sql = readFileSync("supabase/migrations/20261023220000_quote_analysis.sql", "utf8");
    const stale = sql.slice(sql.indexOf("with stale as"), sql.indexOf("), released as"));
    expect(stale).toContain("and day_hkt = v_day");
    expect(sql).toMatch(/where day_hkt = v_day\s+for update;/);
    expect(sql.match(/security definer/gi)).toBeNull();
    expect(sql).toContain("set search_path = ''");
  });
});
