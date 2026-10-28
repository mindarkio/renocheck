import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  admin: true,
  calls: [] as Array<[string, Record<string, unknown>]>,
  result: { data: "2026-10-28" as unknown, error: null as unknown },
  inserts: [] as Array<Record<string, unknown>>,
  insertResult: { data: { id: "22222222-2222-4222-8222-222222222222" } as unknown, error: null as unknown },
}));

vi.mock("@/lib/db-guard", () => ({ assertNotProdDbOutsideProd: () => {} }));
const takeAuthRateLimit = vi.hoisted(() => vi.fn(async () => "ok" as const));
vi.mock("@/lib/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/rate-limit")>()),
  takeAuthRateLimit,
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () =>
    state.admin
      ? {
          rpc: async (name: string, args: Record<string, unknown>) => {
            state.calls.push([name, args]);
            return state.result;
          },
          from: () => ({
            insert: (row: Record<string, unknown>) => {
              state.inserts.push(row);
              return { select: () => ({ single: async () => state.insertResult }) };
            },
          }),
        }
      : null,
}));

import {
  reserveAnonymousQuoteSpend,
  secondsUntilNextHktMidnight,
  settleAnonymousQuoteSpend,
  takeAnonymousQuoteSlot,
} from "./anon-budget";

describe("anonymous IP allowance", () => {
  it("counts per Hong Kong day and per IPv6 /64", async () => {
    // 2026-10-28 23:59:59 HKT
    const late = new Date("2026-10-28T15:59:59Z");
    expect(secondsUntilNextHktMidnight(late)).toBe(1);
    expect(secondsUntilNextHktMidnight(new Date("2026-10-28T16:00:00Z"))).toBe(86_400);
    await takeAnonymousQuoteSlot("2001:db8:1:2:aaaa::1", {}, late);
    await takeAnonymousQuoteSlot("2001:db8:1:2:bbbb::9", {}, new Date("2026-10-28T16:00:01Z"));
    expect(takeAuthRateLimit.mock.calls.map((call) => (call as unknown as [{ key: string; limit: number; windowMs: number }])[0])).toEqual([
      { key: "quote-anon:2026-10-28:2001:0db8:0001:0002::/64", limit: 2, windowMs: 1_000 },
      { key: "quote-anon:2026-10-29:2001:0db8:0001:0002::/64", limit: 2, windowMs: 86_399_000 },
    ]);
  });
});

describe("anonymous spend hold", () => {
  beforeEach(() => {
    state.admin = true;
    state.calls = [];
    state.result = { data: "2026-10-28", error: null };
  });

  it("reserves through the locked RPC with the configured caps", async () => {
    const hold = await reserveAnonymousQuoteSpend(4_530, {
      QUOTE_DAILY_BUDGET_USD: "1",
      QUOTE_FREE_DAILY_BUDGET_USD: "0.8",
      QUOTE_DAILY_CALL_CAP: "300",
    });
    expect(hold).toEqual({ day: "2026-10-28", reserve: 4_530 });
    expect(state.calls).toEqual([
      [
        "reserve_anonymous_quote_spend",
        { p_reserve: 4_530, p_cap_micro: 1_000_000, p_free_cap_micro: 800_000, p_call_cap: 300 },
      ],
    ]);
  });

  it("maps a refused hold to budget and errors to unavailable", async () => {
    state.result = { data: null, error: null };
    expect(await reserveAnonymousQuoteSpend(1, {})).toBe("budget");
    state.result = { data: null, error: { code: "PGRST202" } };
    expect(await reserveAnonymousQuoteSpend(1, {})).toBe("unavailable");
    state.admin = false;
    expect(await reserveAnonymousQuoteSpend(1, {})).toBe("unavailable");
  });

  it("settles with the actual cost, or the full hold when unknown", async () => {
    await settleAnonymousQuoteSpend({ day: "2026-10-28", reserve: 4_530 }, 1_200.2);
    await settleAnonymousQuoteSpend({ day: "2026-10-28", reserve: 4_530 }, null);
    expect(state.calls).toEqual([
      ["settle_anonymous_quote_spend", { p_day: "2026-10-28", p_reserve: 4_530, p_actual: 1_201 }],
      ["settle_anonymous_quote_spend", { p_day: "2026-10-28", p_reserve: 4_530, p_actual: null }],
    ]);
  });

  it("never writes quote_spend_daily directly", () => {
    const source = readFileSync("src/lib/quote-analysis/anon-budget.ts", "utf8");
    expect(source).not.toMatch(/from\("quote_spend_daily"\)/);
    expect(source).not.toContain("seal_nonce");
  });
});
