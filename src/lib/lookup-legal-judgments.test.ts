import { describe, expect, it, vi } from "vitest";
import { lookupLegalJudgments, dedupeByJudgment } from "./lookup-legal-judgments";

function createQueryBuilder(
  resolver: () => Promise<{
    data: unknown[] | null;
    error?: { message: string } | null;
  }>,
) {
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
  source_catalog_id: "legalref-lrs-ju",
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

  it("drops rows with non-allowlisted source_catalog_id", async () => {
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      brRows: [
        {
          ...baseRow,
          source_catalog_id: "judiciary-lrs-fixture",
          br_normalized: "11112222",
          company_name_normalized: "Fixture 公司",
        },
      ],
      matchRows: [],
      fullRows: [],
    });

    const result = await lookupLegalJudgments(supabase, {
      searchLabelUsed: "x",
      br: "11112222",
    });
    expect(result.events).toEqual([]);
  });

  it("drops rows with non-legalref source_url", async () => {
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      brRows: [
        {
          ...baseRow,
          id: "bad-url",
          case_ref: "DCCJ 9/2020",
          source_url: "https://example.com/judgment",
          company_name_normalized: "示例工程有限公司",
          br_normalized: "12345678",
        },
      ],
      matchRows: [],
      fullRows: [],
    });

    const result = await lookupLegalJudgments(supabase, {
      searchLabelUsed: "x",
      br: "12345678",
    });
    expect(result.events).toEqual([]);
  });

  it("aligns hearing quotes by index with points", async () => {
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      brRows: [
        {
          ...baseRow,
          hearing_key_points_zh: ["要點 A", "要點 B"],
          hearing_key_point_quotes_zh: ["引文 A", ""],
          br_normalized: "87654321",
          company_name_normalized: "對齊測試有限公司",
        },
      ],
      matchRows: [],
      fullRows: [],
    });

    const result = await lookupLegalJudgments(supabase, {
      searchLabelUsed: "x",
      br: "87654321",
    });
    expect(result.events[0]?.hearingKeyPointQuotesZh).toEqual(["引文 A", ""]);
  });

  it("dedupes employment_renovation rows by neutral citation", async () => {
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      matchRows: [
        {
          id: "id-a",
          case_ref: "HCLA901/2024",
          company_name_normalized: "ZZQ工程服務有限公司",
          lookup_aliases: [],
          topic_tags: ["neutral_citation:[2025] HKCFI 9901"],
        },
        {
          id: "id-b",
          case_ref: "HCLA903/2024",
          company_name_normalized: "ZZQ工程服務有限公司",
          lookup_aliases: [],
          topic_tags: ["neutral_citation:[2025] HKCFI 9901"],
        },
      ],
      fullRows: [
        {
          ...baseRow,
          id: "id-a",
          case_ref: "HCLA901/2024",
          event_date: "2025-02-10",
          judgment_category: "employment_renovation",
          company_name_normalized: "ZZQ工程服務有限公司",
          topic_tags: ["neutral_citation:[2025] HKCFI 9901"],
          source_url:
            "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=166216&TP=JU",
        },
        {
          ...baseRow,
          id: "id-b",
          case_ref: "HCLA903/2024",
          event_date: "2025-02-09",
          judgment_category: "employment_renovation",
          company_name_normalized: "ZZQ工程服務有限公司",
          topic_tags: ["neutral_citation:[2025] HKCFI 9901"],
          source_url:
            "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=166219&TP=JU",
        },
      ],
    });

    const result = await lookupLegalJudgments(supabase, {
      searchLabelUsed: "ZZQ工程服務有限公司",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.caseRef).toBe("HCLA901/2024");
    expect(result.events[0]?.relatedCaseRefs).toEqual(["HCLA903/2024"]);
    expect(result.events[0]?.neutralCitation).toBe("[2025] HKCFI 9901");
  });

  it("dedupeByJudgment keeps relatedCaseRefs then caps distinct judgments", () => {
    const mk = (caseRef: string, nc: string, dis: number) =>
      ({
        sourceType: "court_judgment" as const,
        caseRef,
        court: "CFI",
        eventDate: "2025-02-10",
        judgmentCategory: "employment_renovation" as const,
        partyRole: "defendant" as const,
        outcomeHint: "defendant_liable" as const,
        hearingKeyPointsZh: ["合成"],
        hearingKeyPointQuotesZh: [""],
        sourceUrl: `https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=${dis}&TP=JU`,
        matchReasonZh: "合成",
        sourceLabel: "x",
        reviewStatus: "auto" as const,
        neutralCitation: nc,
      });
    const rows = [];
    for (const [nc, dis0, prefix] of [
      ["[2025] HKCFI 1", 100, "HCLA90"],
      ["[2025] HKCFI 2", 200, "HCLA91"],
      ["[2025] HKCFI 3", 300, "HCLA92"],
    ] as const) {
      for (let i = 0; i < 4; i++) rows.push(mk(`${prefix}${i}/2024`, nc, dis0 + i));
    }
    const early = dedupeByJudgment(rows.slice(0, 8));
    expect(early.length).toBe(2);
    const full = dedupeByJudgment(rows).slice(0, 8);
    expect(full.length).toBe(3);
    expect(full[0]!.relatedCaseRefs?.length).toBe(3);
  });

  it("excludes employment_labour from events", async () => {
    const supabase = mockSupabase({
      meta: [{ imported_at: "2026-10-16T08:00:00.000Z" }],
      brRows: [
        {
          ...baseRow,
          case_ref: "HCLA999/2024",
          judgment_category: "employment_labour",
          company_name_normalized: "ZZQ工程服務有限公司",
          br_normalized: "99998888",
        },
      ],
      matchRows: [],
      fullRows: [],
    });

    const result = await lookupLegalJudgments(supabase, {
      searchLabelUsed: "ZZQ工程服務有限公司",
      br: "99998888",
    });
    expect(result.events).toEqual([]);
  });
});
