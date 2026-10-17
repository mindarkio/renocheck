import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS,
  setCachedReport,
} from "./search-cache";
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
