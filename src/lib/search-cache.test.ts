import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS,
  setCachedReport,
} from "./search-cache";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";

describe("setCachedReport ttlMs", () => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const supabase = {
    from: vi.fn(() => ({ upsert })),
  } as unknown as SupabaseClient;

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
      contractChecklist: [],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-17T12:00:00.000Z",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
    upsert.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
