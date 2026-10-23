import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUOTE_CHECK_ITEMS } from "@/lib/quote-selfcheck";
import {
  quoteDailyBudgetMicroUsd,
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
      { isQuotation: false, items: [] },
      ids,
    );
    expect(parsed).toEqual({ kind: "not_quotation" });
  });

  it("rejects a shape the model was not asked for", () => {
    expect(parseQuoteModelObject({ isQuotation: true }, ids).kind).toBe("invalid");
  });
});

describe("quote daily budget decision", () => {
  it("defaults the cap to US$2 and blocks on the second comparison", () => {
    expect(quoteDailyBudgetMicroUsd({})).toBe(2_000_000);
    expect(quoteDailyBudgetMicroUsd({ QUOTE_DAILY_BUDGET_USD: "2.5" })).toBe(2_500_000);
    expect(quoteDailyBudgetMicroUsd({ QUOTE_DAILY_BUDGET_USD: "nope" })).toBe(2_000_000);
    expect(
      spendDecision({
        used: 2,
        limit: 2,
        spent: 0,
        reserved: 0,
        reserve: 1,
        cap: 2_000_000,
      }),
    ).toBe("quota");
    expect(
      spendDecision({
        used: 0,
        limit: 2,
        spent: 1_999_000,
        reserved: 2_000,
        reserve: 1_000,
        cap: 2_000_000,
      }),
    ).toBe("budget");
    expect(
      spendDecision({
        used: 1,
        limit: 2,
        spent: 10,
        reserved: 0,
        reserve: 20,
        cap: 2_000_000,
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
    expect(sql).toContain("Asia/Hong_Kong");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("user_id = (select auth.uid())");
    expect(sql).toContain("grant select on table public.quote_analyses to authenticated");
    expect(sql.toLowerCase()).not.toContain("bytea");
    expect(sql).not.toMatch(/\bemail\s+text\b/i);
  });
});
