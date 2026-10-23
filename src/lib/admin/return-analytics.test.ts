import { beforeEach, describe, expect, it, vi } from "vitest";
import { hkWeekStartKey } from "./return-analytics";

const admin = vi.hoisted(() => {
  const from = vi.fn();
  return {
    from,
    getSupabaseAdmin: vi.fn(() => ({ from })),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => admin.getSupabaseAdmin(),
  isSupabaseAdminConfigured: () => true,
}));

import {
  aggregateReturnAnalytics,
  fetchReturnAnalytics,
  type ReturnSearchRow,
  type ReturnUsageRow,
} from "./return-analytics";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const E = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const F = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const G = "99999999-9999-4999-8999-999999999999";

function queryResult(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  for (const method of ["select", "not", "order", "in", "eq", "gte", "range", "maybeSingle"]) {
    query[method] = chain;
  }
  query.then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return query;
}

describe("return analytics buckets", () => {
  const now = new Date("2026-06-17T04:00:00.000Z");

  const searches: ReturnSearchRow[] = [
    { anonId: A, fingerprint: "fp-same", createdAt: "2026-06-08T02:00:00.000Z" },
    { anonId: A, fingerprint: "fp-same", createdAt: "2026-06-15T02:00:00.000Z" },
    { anonId: B, fingerprint: "fp-b", createdAt: "2026-06-17T01:00:00.000Z" },
    { anonId: B, fingerprint: "fp-c", createdAt: "2026-06-17T03:00:00.000Z" },
    { anonId: D, fingerprint: "fp-probe", createdAt: "2026-06-16T01:00:00.000Z" },
    { anonId: D, fingerprint: "fp-probe", createdAt: "2026-06-17T01:00:00.000Z" },
    { anonId: F, fingerprint: "fp-old", createdAt: "2026-05-01T02:00:00.000Z" },
    { anonId: F, fingerprint: "fp-old", createdAt: "2026-06-17T00:00:00.000Z" },
    { anonId: G, fingerprint: "fp-g1", createdAt: "2026-06-05T02:00:00.000Z" },
    { anonId: G, fingerprint: "fp-g2", createdAt: "2026-06-15T02:00:00.000Z" },
  ];

  const usage: ReturnUsageRow[] = [
    { anonId: C, eventType: "quote_page", fingerprint: null, createdAt: "2026-06-12T02:00:00.000Z" },
    { anonId: C, eventType: "quote_page", fingerprint: null, createdAt: "2026-06-16T02:00:00.000Z" },
    { anonId: C, eventType: "quote_all_ticked", fingerprint: null, createdAt: "2026-06-16T03:00:00.000Z" },
    { anonId: C, eventType: "quote_copy_reply", fingerprint: null, createdAt: "2026-06-16T03:30:00.000Z" },
    { anonId: E, eventType: "report_official_link", fingerprint: null, createdAt: "2026-06-17T02:00:00.000Z" },
    { anonId: A, eventType: "report_share", fingerprint: "fp-same", createdAt: "2026-06-15T05:00:00.000Z" },
    { anonId: D, eventType: "report_share", fingerprint: "fp-probe", createdAt: "2026-06-17T02:30:00.000Z" },
  ];

  it("counts weekly devices, exclusive gaps, return actions, and the funnel", () => {
    const result = aggregateReturnAnalytics(
      searches,
      usage,
      [
        { fingerprint: "fp-probe", term: "ZZQ_audit probe" },
        { fingerprint: "fp-same", term: "示例裝修有限公司" },
      ],
      now,
      7,
    );

    const earlier = hkWeekStartKey("2026-06-12T02:00:00.000Z");
    const later = hkWeekStartKey("2026-06-17T01:00:00.000Z");
    expect(earlier).not.toBe(later);
    expect(result.weeks.find((week) => week.weekStart === earlier)).toMatchObject({
      newDevices: 1,
      returningDevices: 0,
    });
    expect(result.weeks.find((week) => week.weekStart === later)).toMatchObject({
      newDevices: 2,
      returningDevices: 4,
    });
    expect(result.intervals).toEqual({
      within1Day: 1,
      within7Days: 2,
      within30Days: 1,
      over30Days: 1,
    });
    expect(result.returnerActions).toEqual({
      sameCompany: 2,
      differentCompany: 2,
      usedQuote: 1,
    });
    expect(result.funnel).toEqual({
      quotePage: 2,
      quoteAllTicked: 1,
      quoteCopyReply: 1,
      reportOfficialLink: 1,
      reportShare: 1,
    });
    expect(JSON.stringify(result)).not.toContain("ZZQ");
    expect(JSON.stringify(result)).not.toContain("示例");
  });

  it("puts gap edges in the inclusive bucket and ignores a first visit", () => {
    const start = "2026-06-18T00:00:00.000Z";
    const day = 86_400_000;
    const plus = (ms: number) => new Date(Date.parse(start) + ms).toISOString();
    const rows: ReturnSearchRow[] = [
      { anonId: "a", fingerprint: "1", createdAt: start },
      { anonId: "a", fingerprint: "1", createdAt: plus(day) },
      { anonId: "b", fingerprint: "2", createdAt: start },
      { anonId: "b", fingerprint: "3", createdAt: plus(day + 1) },
      { anonId: "c", fingerprint: "4", createdAt: start },
      { anonId: "c", fingerprint: "4", createdAt: plus(7 * day) },
      { anonId: "d", fingerprint: "5", createdAt: start },
      { anonId: "d", fingerprint: "6", createdAt: plus(7 * day + 1) },
      { anonId: "e", fingerprint: "7", createdAt: start },
      { anonId: "e", fingerprint: "7", createdAt: plus(30 * day) },
      { anonId: "f", fingerprint: "8", createdAt: start },
      { anonId: "f", fingerprint: "9", createdAt: plus(30 * day + 1) },
    ];
    const result = aggregateReturnAnalytics(
      rows,
      [],
      [],
      new Date(Date.parse(start) + 40 * day),
      90,
    );
    expect(result.intervals).toEqual({
      within1Day: 1,
      within7Days: 2,
      within30Days: 2,
      over30Days: 1,
    });
    expect(result.returnerActions).toEqual({
      sameCompany: 3,
      differentCompany: 3,
      usedQuote: 0,
    });
  });
});

describe("fetchReturnAnalytics degradation", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("VERCEL_ENV", "test");
    admin.from.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns empty counts when the anon column and usage table are not migrated", async () => {
    admin.from.mockImplementation((table: string) => {
      if (table === "search_events") {
        return queryResult({
          data: null,
          error: {
            code: "PGRST204",
            message:
              "Could not find the 'anon_id' column of 'search_events' in the schema cache",
          },
        });
      }
      if (table === "usage_events") {
        return queryResult({
          data: null,
          error: {
            code: "PGRST205",
            message: "Could not find the table 'public.usage_events' in the schema cache",
          },
        });
      }
      return queryResult({ data: [], error: null });
    });

    const result = await fetchReturnAnalytics(7);
    expect(result.searchAnon).toBe("pending");
    expect(result.usageEvents).toBe("pending");
    expect(result.readError).toBe(false);
    expect(result.funnel.quotePage).toBe(0);
    expect(result.intervals.within1Day).toBe(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("flags a read error without throwing when the query fails for another reason", async () => {
    admin.from.mockImplementation(() =>
      queryResult({
        data: null,
        error: { code: "57014", message: "statement timeout" },
      }),
    );
    const result = await fetchReturnAnalytics(30);
    expect(result.readError).toBe(true);
    expect(result.searchAnon).toBe("ready");
    expect(result.funnel.reportShare).toBe(0);
  });
});
