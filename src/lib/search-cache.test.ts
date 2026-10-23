import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isReportCrLookupDegraded,
  isReportLookupDegraded,
  LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS,
  logSearchEvent,
  setCachedReport,
} from "./search-cache";
import { CR_ESERVICES_URL } from "./report-trust-copy-zh";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";

function mockSupabase(
  maybeSingle: ReturnType<typeof vi.fn>,
  upsert = vi.fn().mockResolvedValue({ error: null }),
) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
      upsert,
    })),
  } as unknown as SupabaseClient;
}

describe("setCachedReport ttlMs", () => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: null });
  const supabase = mockSupabase(maybeSingle, upsert);

  const report = {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "示例公司",
      matchType: "company_name" as const,
      queryEcho: "示例公司",
      searchLabelUsed: "示例公司",
      nameAlignment: "user_only" as const,
    },
    grade: "C" as const,
    confidence: "low" as const,
    evaluation: buildEvaluationStub({
      overallGrade: "C",
      confidence: "low",
      mwcMatched: false,
      boundHitCount: 0,
      highlightCount: 0,
    }),
    summaryZh: "摘要",
    official: {
      mwcMatched: false,
      legalLookupStatus: "timeout" as const,
    },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      actionableClauses: [],
      contractChecklist: ["有無書面合約？"],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-17T12:00:00.000Z",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
    upsert.mockClear();
    maybeSingle.mockReset();
    maybeSingle.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips upsert when healthy non-degraded cache exists", async () => {
    const healthy = {
      ...report,
      official: { mwcMatched: false, legalLookupStatus: "ok" as const },
    };
    maybeSingle.mockResolvedValueOnce({
      data: {
        report: healthy,
        expires_at: "2026-10-18T12:00:00.000Z",
      },
    });

    await setCachedReport(supabase, "fp1", { matchType: "company_name" }, report, {
      ttlMs: LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS,
      skipIfHealthyCacheExists: true,
    });

    expect(upsert).not.toHaveBeenCalled();
  });

  it("uses degraded TTL when options.ttlMs is set", async () => {
    await setCachedReport(supabase, "fp1", { matchType: "company_name" }, report, {
      ttlMs: LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        fingerprint: "fp1",
        expires_at: "2026-10-17T12:10:00.000Z",
        report,
      }),
    );
  });

  it("overwrites degraded cache when writing healthy report", async () => {
    const healthy = {
      ...report,
      official: { mwcMatched: false, legalLookupStatus: "ok" as const },
      summaryZh: "完整查證摘要。",
    };

    await setCachedReport(
      supabase,
      "fp1",
      { matchType: "company_name" },
      healthy,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        fingerprint: "fp1",
        report: healthy,
      }),
    );
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("warns and does not throw when upsert fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failingUpsert = vi
      .fn()
      .mockResolvedValue({ error: { message: "quota" } });
    const failingSupabase = mockSupabase(maybeSingle, failingUpsert);

    await expect(
      setCachedReport(
        failingSupabase,
        "fp1",
        { matchType: "company_name" },
        report,
      ),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("search_cache upsert failed"),
    );
  });

  it("isReportCrLookupDegraded and isReportLookupDegraded", () => {
    const crTimeout = {
      ...report,
      official: {
        mwcMatched: false,
        companiesRegistry: {
          lookupStatus: "timeout" as const,
          retrievedAt: "2026-10-18T12:00:00.000Z",
          hints: [],
          icrisHomeUrl: CR_ESERVICES_URL,
        },
      },
    };
    expect(isReportCrLookupDegraded(crTimeout)).toBe(true);
    expect(isReportLookupDegraded(crTimeout)).toBe(true);
    const legalOnly = {
      ...report,
      official: { mwcMatched: false, legalLookupStatus: "timeout" as const },
    };
    expect(isReportCrLookupDegraded(legalOnly)).toBe(false);
    expect(isReportLookupDegraded(legalOnly)).toBe(true);
  });

  it("skips upsert when healthy cache exists and new report is CR degraded", async () => {
    const healthy = {
      ...report,
      official: { mwcMatched: false, legalLookupStatus: "ok" as const },
    };
    const crDegraded = {
      ...report,
      official: {
        mwcMatched: false,
        legalLookupStatus: "ok" as const,
        companiesRegistry: {
          lookupStatus: "timeout" as const,
          retrievedAt: "2026-10-18T12:00:00.000Z",
          hints: [],
          icrisHomeUrl: CR_ESERVICES_URL,
        },
      },
    };
    maybeSingle.mockResolvedValueOnce({
      data: {
        report: healthy,
        expires_at: "2026-10-18T12:00:00.000Z",
      },
    });

    await setCachedReport(
      supabase,
      "fp1",
      { matchType: "company_name" },
      crDegraded,
      {
        ttlMs: LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS,
        skipIfHealthyCacheExists: true,
      },
    );

    expect(upsert).not.toHaveBeenCalled();
  });

  it("writes degraded report after prior healthy row expired", async () => {
    const healthy = {
      ...report,
      official: { mwcMatched: false, legalLookupStatus: "ok" as const },
    };
    maybeSingle.mockResolvedValueOnce({
      data: {
        report: healthy,
        expires_at: "2026-10-16T12:00:00.000Z",
      },
    });

    await setCachedReport(supabase, "fp1", { matchType: "company_name" }, report, {
      ttlMs: LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS,
      skipIfHealthyCacheExists: true,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        fingerprint: "fp1",
        report,
      }),
    );
  });
});

describe("logSearchEvent", () => {
  const anonId = "12345678-1234-4234-8234-123456789abc";
  const fingerprint = "ab".repeat(16);

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores only fingerprint, cache hit, and anon id", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({ insert })),
    } as unknown as SupabaseClient;

    await logSearchEvent(supabase, fingerprint, true, anonId);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toEqual({
      fingerprint,
      cache_hit: true,
      anon_id: anonId,
    });
  });

  it("retries without anon id when the column is not migrated yet", async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({
        error: {
          code: "PGRST204",
          message:
            "Could not find the 'anon_id' column of 'search_events' in the schema cache",
        },
      })
      .mockResolvedValueOnce({ error: null });
    const supabase = {
      from: vi.fn(() => ({ insert })),
    } as unknown as SupabaseClient;

    await expect(
      logSearchEvent(supabase, fingerprint, false, anonId),
    ).resolves.toBeUndefined();
    expect(insert).toHaveBeenNthCalledWith(2, {
      fingerprint,
      cache_hit: false,
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("does not throw when the insert fails for another reason", async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: "57014", message: "statement timeout" },
    });
    const supabase = {
      from: vi.fn(() => ({ insert })),
    } as unknown as SupabaseClient;

    await expect(
      logSearchEvent(supabase, fingerprint, false, "not-a-uuid"),
    ).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).not.toHaveProperty("anon_id");
    expect(insert.mock.calls[0][0]).not.toHaveProperty("ip");
    expect(insert.mock.calls[0][0]).not.toHaveProperty("user_agent");
  });
});
