import { describe, expect, it, vi } from "vitest";
import { lookupLegalJudgments } from "./lookup-legal-judgments";

function createQueryBuilder(resolver: () => Promise<{ data: unknown[] | null; error?: null }>) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "order", "limit", "eq", "ilike", "range", "in"]) {
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
  metaError?: { message: string } | null;
  brRows?: unknown[];
  matchRows?: unknown[];
  fullRows?: unknown[];
}) {
  let call = 0;
  const from = vi.fn(() => {
    call += 1;
    if (call === 1) {
      return createQueryBuilder(async () => ({
        data: options.meta,
        error: options.metaError ?? null,
      }));
    }
    if (options.brRows && call === 2) {
      return createQueryBuilder(async () => ({
        data: options.brRows ?? null,
        error: null,
      }));
    }
    if (call === 2 || (options.brRows && call === 3)) {
      return createQueryBuilder(async () => ({
        data: options.matchRows ?? [],
        error: null,
      }));
    }
    return createQueryBuilder(async () => ({
      data: options.fullRows ?? [],
      error: null,
    }));
  });

  return { from } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

const baseRow = {
  id: "id-1",
  source_type: "court_judgment",
  court: "District Court",
  hearing_key_points_zh: ["要點 A"],
  source_url: "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=1&TP=JU",
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
      matchRows: [],
      fullRows: [],
    });

    const result = await lookupLegalJudgments(supabase, {
      searchLabelUsed: "無關公司",
    });
    expect(result.registryAsOf).toBe("2026-10-16T08:00:00.000Z");
    expect(result.events).toEqual([]);
  });

  it("matches oldest event_date row when scanning full renovation set", async () => {
    const oldId = "old-id";
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      matchRows: [
        {
          id: "new-id",
          case_ref: "DCCJ 9002/2025",
          company_name_normalized: "其他有限公司",
          lookup_aliases: [],
          topic_tags: [],
        },
        {
          id: oldId,
          case_ref: "DCCJ 1/1999",
          company_name_normalized: "古老裝修工程有限公司",
          lookup_aliases: [],
          topic_tags: [],
        },
      ],
      fullRows: [
        {
          ...baseRow,
          id: oldId,
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
