import { describe, expect, it, vi } from "vitest";
import { lookupLegalJudgments } from "./lookup-legal-judgments";

function createQueryBuilder(resolver: () => Promise<{ data: unknown[] | null }>) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "order", "limit", "eq", "ilike"]) {
    builder[method] = vi.fn(chain);
  }
  builder.then = undefined;
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
  companyRows?: unknown[];
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
      data: options.companyRows ?? [],
    }));
  });

  return { from } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

describe("lookupLegalJudgments", () => {
  it("returns registryAsOf from latest import row", async () => {
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      companyRows: [],
    });

    const result = await lookupLegalJudgments(supabase, {
      searchLabelUsed: "無關公司",
    });
    expect(result.registryAsOf).toBe("2026-10-16T08:00:00.000Z");
    // Postgres-style input is normalized in lookup
    expect(result.events).toEqual([]);
  });

  it("matches by BR first", async () => {
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      brRows: [
        {
          source_type: "court_judgment",
          case_ref: "DCCJ 9001/2020",
          court: "District Court",
          event_date: "2021-03-15",
          hearing_key_points_zh: ["要點 A"],
          source_url: "https://example.com/j/1",
          judgment_category: "renovation_engineering_civil",
          party_role: "defendant",
          outcome_hint: null,
          procedure_stage: "final_judgment",
          company_name_normalized: "示例裝修工程有限公司",
          br_normalized: "12345678",
          imported_at: "2026-10-16T08:00:00.000Z",
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
});
