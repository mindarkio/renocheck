import { beforeEach, describe, expect, it, vi } from "vitest";
import { openQuoteResult, sealQuoteResult } from "./seal";

const countUserQuoteUsesToday = vi.hoisted(() => vi.fn());
const insertQuoteChecklist = vi.hoisted(() => vi.fn());
const saveQuoteCompanyNames = vi.hoisted(() => vi.fn());

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
    countUserQuoteUsesToday.mockReset();
    insertQuoteChecklist.mockReset();
    saveQuoteCompanyNames.mockReset();
    countUserQuoteUsesToday.mockResolvedValue(0);
    insertQuoteChecklist.mockResolvedValue({ ok: true, id: "22222222-2222-4222-8222-222222222222" });
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
    expect(result.body.companyName).toBeUndefined();
  });

  it("does not burn the seal when the checklist insert fails", async () => {
    const blob = sealed();
    insertQuoteChecklist.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    const result = await claimSealedQuote({ userId: USER, sealed: blob, env, now: now + 1000 });
    expect(result.status).toBe(503);
    expect(saveQuoteCompanyNames).not.toHaveBeenCalled();
    const retry = await claimSealedQuote({ userId: USER, sealed: blob, env, now: now + 2000 });
    expect(retry.status).toBe(200);
  });

  it("rejects a replayed blob through the unique seal nonce", async () => {
    const blob = sealed();
    insertQuoteChecklist
      .mockResolvedValueOnce({ ok: true, id: "22222222-2222-4222-8222-222222222222" })
      .mockResolvedValueOnce({ ok: false, reason: "duplicate" });
    await claimSealedQuote({ userId: USER, sealed: blob, env, now });
    const again = await claimSealedQuote({ userId: USER, sealed: blob, env, now });
    expect(again.status).toBe(409);
    expect(again.body.companyName).toBeUndefined();
    const nonces = insertQuoteChecklist.mock.calls.map((call) => (call[0] as { sealNonce: string }).sealNonce);
    expect(nonces[0]).toBe(openQuoteResult(blob, env, now).nonce);
    expect(nonces[1]).toBe(nonces[0]);
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
    expect(insertQuoteChecklist).not.toHaveBeenCalled();
  });
});
