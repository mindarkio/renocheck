import { beforeEach, describe, expect, it, vi } from "vitest";
import { sealQuoteResult } from "./seal";

const takeAuthRateLimit = vi.hoisted(() => vi.fn());
const countUserQuoteUsesToday = vi.hoisted(() => vi.fn());
const insertQuoteChecklist = vi.hoisted(() => vi.fn());
const saveQuoteCompanyNames = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/rate-limit", () => ({ takeAuthRateLimit }));
vi.mock("@/lib/quote-analysis/anon-budget", () => ({
  countUserQuoteUsesToday,
  insertQuoteChecklist,
}));
vi.mock("@/lib/quote-analysis/company-names", () => ({ saveQuoteCompanyNames }));

import { claimSealedQuote } from "./claim";

const env = { QUOTE_RESULT_SEAL_SECRET: "k".repeat(32) };
const NAME = "合成測試工程有限公司";
const USER = "11111111-1111-4111-8111-111111111111";
const now = 1_700_000_000_000;

function sealed() {
  return sealQuoteResult(
    {
      items: [{ id: "demolition", status: "clear" }],
      companyName: NAME,
      pageCount: 1,
      inputTokens: 8,
      outputTokens: 2,
      actualMicroUsd: 5,
    },
    env,
    now,
  ).sealed;
}

describe("claimSealedQuote", () => {
  beforeEach(() => {
    takeAuthRateLimit.mockReset();
    countUserQuoteUsesToday.mockReset();
    insertQuoteChecklist.mockReset();
    saveQuoteCompanyNames.mockReset();
    takeAuthRateLimit.mockResolvedValue("ok");
    countUserQuoteUsesToday.mockResolvedValue(0);
    insertQuoteChecklist.mockResolvedValue("22222222-2222-4222-8222-222222222222");
    saveQuoteCompanyNames.mockResolvedValue("saved");
  });

  it("returns the name only after a valid claim and stores it for that user", async () => {
    const blob = sealed();
    expect(blob.includes(NAME)).toBe(false);
    const result = await claimSealedQuote({ userId: USER, sealed: blob, env, now: now + 1000 });
    expect(result.status).toBe(200);
    expect(result.body.companyName).toBe(NAME);
    expect(result.body.items?.[0]?.id).toBe("demolition");
    expect(saveQuoteCompanyNames).toHaveBeenCalledWith(
      expect.objectContaining({ analysisId: result.body.id, userId: USER, extracted: NAME }),
    );
    const stored = insertQuoteChecklist.mock.calls[0]?.[0] as { items: unknown; userId: string };
    expect(stored.userId).toBe(USER);
    expect(JSON.stringify(stored.items)).not.toContain(NAME);
  });

  it("applies the signed-in account's daily quota before storing", async () => {
    countUserQuoteUsesToday.mockResolvedValue(99);
    const result = await claimSealedQuote({ userId: USER, sealed: sealed(), env, now: now + 1000 });
    expect(result.status).toBe(429);
    expect(result.body.error).toBe("quota");
    expect(insertQuoteChecklist).not.toHaveBeenCalled();
    expect(saveQuoteCompanyNames).not.toHaveBeenCalled();
    expect(takeAuthRateLimit).not.toHaveBeenCalled();
    expect(result.body.companyName).toBeUndefined();
  });

  it("does not burn the seal when the checklist insert fails", async () => {
    insertQuoteChecklist.mockResolvedValue(null);
    const result = await claimSealedQuote({ userId: USER, sealed: sealed(), env, now: now + 1000 });
    expect(result.status).toBe(503);
    expect(takeAuthRateLimit).not.toHaveBeenCalled();
    expect(saveQuoteCompanyNames).not.toHaveBeenCalled();
  });

  it("rejects a replayed blob", async () => {
    const blob = sealed();
    takeAuthRateLimit.mockResolvedValueOnce("ok").mockResolvedValueOnce("limited");
    expect((await claimSealedQuote({ userId: USER, sealed: blob, env, now })).status).toBe(200);
    const again = await claimSealedQuote({ userId: USER, sealed: blob, env, now });
    expect(again.status).toBe(409);
    expect(again.body.companyName).toBeUndefined();
    // The seal slot is taken only after the row exists, so a failed insert can be retried.
    expect(insertQuoteChecklist).toHaveBeenCalledTimes(2);
    expect(saveQuoteCompanyNames).toHaveBeenCalledTimes(1);
  });

  it("rejects an expired blob before it can be stored", async () => {
    const blob = sealed();
    const result = await claimSealedQuote({
      userId: USER,
      sealed: blob,
      env,
      now: now + 31 * 60 * 1000,
    });
    expect(result.status).toBe(410);
    expect(result.body.companyName).toBeUndefined();
    expect(takeAuthRateLimit).not.toHaveBeenCalled();
    expect(insertQuoteChecklist).not.toHaveBeenCalled();
  });
});
