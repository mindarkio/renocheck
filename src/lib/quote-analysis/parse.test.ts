import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUOTE_CHECK_ITEMS } from "@/lib/quote-selfcheck";
import {
  quoteDailyBudgetMicroUsd,
  quoteDailyCallCap,
  quoteFreeDailyBudgetMicroUsd,
  spendDecision,
} from "@/lib/quote-analysis/config";
import {
  activeQuoteCheckIds,
  parseQuoteModelObject,
  quoteFindingText,
} from "@/lib/quote-analysis/schema";

const ids = QUOTE_CHECK_ITEMS.map((item) => item.id);

describe("quote analysis parser", () => {
  it("keeps arithmetic off and fills missing checklist ids", () => {
    expect(activeQuoteCheckIds({})).toEqual(ids);
    expect(activeQuoteCheckIds({})).not.toContain("arithmetic");
    expect(ids).toHaveLength(20);

    const parsed = parseQuoteModelObject(
      {
        isQuotation: true,
        companyName: null,
        items: [{ id: "demolition", status: "clear" }],
      },
      ids,
    );
    expect(parsed.kind).toBe("quotation");
    if (parsed.kind !== "quotation") return;
    expect(parsed.items).toHaveLength(20);
    expect(parsed.items[0]).toEqual({ id: "demolition", status: "clear" });
    expect(parsed.items.filter((item) => item.status === "missing")).toHaveLength(19);
    const finding = quoteFindingText(parsed.items[0]!);
    expect(finding.startsWith("有寫清楚。")).toBe(true);
    expect(finding).toContain("舊地磚");
    expect(parsed.items.some((item) => item.id === "arithmetic")).toBe(false);
  });

  it("rejects unknown ids and keeps the first status for a repeated id", () => {
    expect(
      parseQuoteModelObject({ isQuotation: true, items: [{ id: "x_unknown", status: "clear" }] }, ids)
        .kind,
    ).toBe("invalid");
    const parsed = parseQuoteModelObject(
      {
        isQuotation: true,
        companyName: null,
        items: [
          { id: "demolition", status: "vague" },
          { id: "demolition", status: "clear" },
        ],
      },
      ids,
    );
    expect(parsed.kind === "quotation" && parsed.items[0]?.status).toBe("vague");
  });

  it("treats an empty non-quote as not a quotation", () => {
    const parsed = parseQuoteModelObject(
      { isQuotation: false, companyName: null, items: [] },
      ids,
    );
    expect(parsed).toEqual({ kind: "not_quotation" });
  });

  it("strips bidi overrides, isolates, and zero-width characters from the company name", () => {
    const parsed = parseQuoteModelObject(
      {
        isQuotation: true,
        companyName: "合成\u202e測試\u200b工程\u2066有限\u200f\u061c\u0085\u009b公司\n",
        items: [],
      },
      ids,
    );
    expect(parsed.kind).toBe("quotation");
    if (parsed.kind !== "quotation") return;
    expect(parsed.companyName).toBe("合成測試工程有限公司");
  });

  it("returns the company name without putting it on a checklist row", () => {
    const parsed = parseQuoteModelObject(
      {
        isQuotation: true,
        companyName: "  合成測試工程有限公司  ",
        items: [{ id: "demolition", status: "clear" }],
      },
      ids,
    );
    expect(parsed.kind).toBe("quotation");
    if (parsed.kind !== "quotation") return;
    expect(parsed.companyName).toBe("合成測試工程有限公司");
    expect(parsed.items.every((item) => !("companyName" in item))).toBe(true);
    expect(JSON.stringify(parsed.items)).not.toContain("合成測試工程有限公司");
    const empty = parseQuoteModelObject(
      { isQuotation: true, companyName: "   ", items: [] },
      ids,
    );
    expect(empty.kind === "quotation" && empty.companyName).toBe(null);
  });

  it("rejects a shape the model was not asked for", () => {
    expect(parseQuoteModelObject({ isQuotation: true }, ids).kind).toBe("invalid");
  });

  it("rejects more items than the checklist", () => {
    const full = ids.map((id) => ({ id, status: "missing" as const }));
    expect(parseQuoteModelObject({ isQuotation: true, companyName: null, items: full }, ids).kind).toBe("quotation");
    expect(
      parseQuoteModelObject(
        {
          isQuotation: true,
          items: [...full, { id: ids[0], status: "clear" }],
        },
        ids,
      ).kind,
    ).toBe("invalid");
  });
});

describe("quote daily budget decision", () => {
  it("defaults the cap to US$1, the free share to US$0.80, and 300 calls", () => {
    expect(quoteDailyBudgetMicroUsd({})).toBe(1_000_000);
    expect(quoteFreeDailyBudgetMicroUsd({})).toBe(800_000);
    expect(quoteDailyCallCap({})).toBe(300);
    expect(quoteDailyBudgetMicroUsd({ QUOTE_DAILY_BUDGET_USD: "2.5" })).toBe(2_500_000);
    expect(quoteDailyBudgetMicroUsd({ QUOTE_DAILY_BUDGET_USD: "nope" })).toBe(1_000_000);
    expect(quoteFreeDailyBudgetMicroUsd({ QUOTE_FREE_DAILY_BUDGET_USD: "0.5" })).toBe(500_000);
    expect(quoteFreeDailyBudgetMicroUsd({ QUOTE_FREE_DAILY_BUDGET_USD: "0" })).toBe(0);
    expect(quoteDailyCallCap({ QUOTE_DAILY_CALL_CAP: "10" })).toBe(10);
    expect(quoteDailyCallCap({ QUOTE_DAILY_CALL_CAP: "0" })).toBe(0);
    expect(quoteDailyCallCap({ QUOTE_DAILY_CALL_CAP: "10.5" })).toBe(300);
    const room = { freeCap: 800_000, calls: 0, callCap: 300 };
    expect(
      spendDecision({
        used: 2,
        limit: 2,
        spent: 900_000,
        reserved: 0,
        reserve: 1,
        cap: 1_000_000,
        ...room,
      }),
    ).toBe("quota");
    expect(
      spendDecision({
        used: 0,
        limit: 2,
        spent: 790_000,
        reserved: 5_000,
        reserve: 6_000,
        cap: 1_000_000,
        ...room,
      }),
    ).toBe("budget");
    expect(
      spendDecision({
        used: 0,
        limit: 2,
        spent: 100_000,
        reserved: 0,
        reserve: 1,
        cap: 1_000_000,
        freeCap: 800_000,
        calls: 300,
        callCap: 300,
      }),
    ).toBe("budget");
    expect(
      spendDecision({
        used: 0,
        limit: 2,
        spent: 900_000,
        reserved: 0,
        reserve: 200_000,
        cap: 1_000_000,
        freeCap: 2_000_000,
        calls: 0,
        callCap: 300,
      }),
    ).toBe("budget");
    expect(
      spendDecision({
        used: 1,
        limit: 2,
        spent: 10,
        reserved: 0,
        reserve: 20,
        cap: 1_000_000,
        ...room,
      }),
    ).toBe("ok");
  });

  it("mirrors the migration's quota and budget comparisons", () => {
    const sql = readFileSync(
      "supabase/migrations/20261023220000_quote_analysis.sql",
      "utf8",
    );
    expect(sql).toContain("v_used >= p_daily_limit");
    expect(sql).toContain("v_spent + v_reserved + p_reserve > p_cap_micro");
    expect(sql).toContain("v_spent + v_reserved + p_reserve > p_free_cap_micro");
    expect(sql).toContain("v_calls >= p_call_cap");
    const begin = sql.slice(
      sql.indexOf("create or replace function public.begin_quote_analysis"),
      sql.indexOf("create or replace function public.finish_quote_analysis"),
    );
    expect(begin.indexOf("for update")).toBeLessThan(begin.indexOf("v_calls >= p_call_cap"));
    expect(begin.indexOf("v_calls >= p_call_cap")).toBeLessThan(begin.indexOf("calls = calls + 1"));
    expect(sql).toContain("Asia/Hong_Kong");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("user_id = (select auth.uid())");
    expect(sql).toContain("grant select on table public.quote_analyses to authenticated");
    expect(sql.toLowerCase()).not.toContain("bytea");
    expect(sql).not.toMatch(/\bemail\s+text\b/i);
  });
});
