import { describe, expect, it, vi } from "vitest";
import { lookupLegalJudgments } from "./lookup-legal-judgments";

function createQueryBuilder(resolver: () => Promise<{ data: unknown[] | null }>) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "order", "limit", "eq", "ilike", "range"]) {
    builder[method] = vi.fn(chain);
  }
  Object.defineProperty(builder, "then", {
    get() {
      return (onFulfilled: (v: unknown) => unknown) =>
        resolver().then(onFulfilled);
    },
  });
  return builder;
}

function mockSupabase(options: {
  meta: unknown[];
  brRows?: unknown[];
  renovationRows?: unknown[];
}) {
  let call = 0;
  const from = vi.fn(() => {
    call += 1;
    if (call === 1) {
      return createQueryBuilder(async () => ({ data: options.meta }));
    }
    if (options.brRows && call === 2) {
      return createQueryBuilder(async () => ({
        data: options.brRows ?? null,
      }));
    }
    return createQueryBuilder(async () => ({
      data: options.renovationRows ?? [],
    }));
  });

  return { from } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

const baseRow = {
  source_type: "court_judgment",
  court: "District Court",
  hearing_key_points_zh: ["要點 A"],
  source_url: "https://example.com/j/1",
  judgment_category: "renovation_engineering_civil",
  party_role: "defendant",
  outcome_hint: null,
  procedure_stage: "final_judgment",
  br_normalized: null,
  lookup_aliases: null,
  imported_at: "2026-10-16T08:00:00.000Z",
  review_status: "auto",
  topic_tags: null,
};

describe("lookupLegalJudgments", () => {
  it("returns registryAsOf from latest import row", async () => {
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      renovationRows: [],
    });

    const result = await lookupLegalJudgments(supabase, {
      searchLabelUsed: "無關公司",
    });
    expect(result.registryAsOf).toBe("2026-10-16T08:00:00.000Z");
    expect(result.events).toEqual([]);
  });

  it("matches by BR first", async () => {
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      brRows: [
        {
          ...baseRow,
          case_ref: "DCCJ 9001/2020",
          event_date: "2021-03-15",
          company_name_normalized: "示例裝修工程有限公司",
          br_normalized: "12345678",
        },
      ],
    });

    const result = await lookupLegalJudgments(supabase, {
      searchLabelUsed: "其他名",
      br: "12345678",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.caseRef).toBe("DCCJ 9001/2020");
    expect(result.events[0]?.matchReasonZh).toContain("商業登記");
  });

  it("matches oldest event_date row when scanning full renovation set", async () => {
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      renovationRows: [
        {
          ...baseRow,
          case_ref: "DCCJ 9002/2025",
          event_date: "2025-06-01",
          company_name_normalized: "其他有限公司",
        },
        {
          ...baseRow,
          case_ref: "DCCJ 1/1999",
          event_date: "1999-01-15",
          company_name_normalized: "古老裝修工程有限公司",
        },
      ],
    });

    const result = await lookupLegalJudgments(supabase, {
      searchLabelUsed: "古老裝修工程有限公司",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.caseRef).toBe("DCCJ 1/1999");
  });
});
