import { describe, expect, it } from "vitest";
import { openQuoteResult, QUOTE_SEAL_TTL_MS, sealQuoteResult } from "./seal";

const env = { QUOTE_RESULT_SEAL_SECRET: "k".repeat(32) };
const NAME = "合成測試工程有限公司";

const payload = {
  items: [{ id: "demolition", status: "clear" as const }],
  companyName: NAME,
  pageCount: 1,
  inputTokens: 10,
  outputTokens: 4,
  actualMicroUsd: 12,
};

describe("quote result seal", () => {
  it("keeps the company name out of the sealed string and rejects tampering and expiry", () => {
    const now = 1_700_000_000_000;
    const { sealed } = sealQuoteResult(payload, env, now);
    expect(sealed.includes(NAME)).toBe(false);
    expect(openQuoteResult(sealed, env, now + 1000).companyName).toBe(NAME);
    expect(() => openQuoteResult(`${sealed}x`, env, now)).toThrow(/seal_invalid/);
    const flipped = `${sealed.slice(0, -2)}aa`;
    expect(() => openQuoteResult(flipped, env, now)).toThrow(/seal_invalid/);
    expect(() => openQuoteResult(sealed, env, now + QUOTE_SEAL_TTL_MS + 1)).toThrow(/seal_expired/);
    expect(() => sealQuoteResult(payload, { QUOTE_RESULT_SEAL_SECRET: "short" }, now)).toThrow(
      /seal_unavailable/,
    );
  });
});
