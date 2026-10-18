import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DISCLAIMER_VERSION, REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { RiskReport } from "./report-schema";
import { LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX } from "./legal-event-display";
import { LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS } from "./search-cache";

const supabase = {} as SupabaseClient;

function baseLlmReport(): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "low",
    mwcMatched: false,
    boundHitCount: 0,
    highlightCount: 0,
  });
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "示例裝修有限公司",
      matchType: "company_name",
      queryEcho: "示例裝修有限公司",
      searchLabelUsed: "示例裝修有限公司",
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "low",
    evaluation,
    summaryZh: "公開資料有限，建議自行核實。",
    official: { mwcMatched: false },
    signals: {
      discussionCount: 0,
      themes: [],
      highlights: [],
      serpHitCount: 0,
      boundHitCount: 0,
      retrievalEvidence: [],
      actionableClauses: [],
      contractChecklist: ["有無書面合約？"],
    },
    disclaimerVersion: DISCLAIMER_VERSION,
    generatedAt: "2026-10-17T12:00:00.000Z",
  };
}

vi.mock("./supabase/admin", () => ({
  isSupabaseAdminConfigured: () => true,
  getSupabaseAdmin: () => supabase,
}));

vi.mock("./web-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./web-search")>();
  return {
    ...actual,
    isSerpConfigured: () => true,
    fetchWebSearchHitsForEntity: vi.fn().mockResolvedValue({ hits: [] }),
    fetchSerpOrganicHits: vi.fn(),
    mergeWebSearchHits: vi.fn(),
    buildBrandHostForumQuery: vi.fn(),
  };
});

vi.mock("./llm-model", () => ({
  isLlmConfigured: () => true,
}));

vi.mock("./mwc-lookup", () => ({
  lookupMwcWithMeta: vi.fn().mockResolvedValue({
    row: null,
    ambiguous: false,
  }),
}));

vi.mock("./llm-risk-report", () => ({
  synthesizeRiskReport: vi.fn(),
}));

vi.mock("./lookup-legal-judgments", () => ({
  lookupLegalJudgments: vi.fn(),
}));

const getCachedReport = vi.fn();
const setCachedReport = vi.fn().mockResolvedValue(undefined);
const logSearchEvent = vi.fn().mockResolvedValue(undefined);

vi.mock("./search-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./search-cache")>();
  return {
    ...actual,
    getCachedReport: (...args: unknown[]) => getCachedReport(...args),
    setCachedReport: (...args: unknown[]) => setCachedReport(...args),
    logSearchEvent: (...args: unknown[]) => logSearchEvent(...args),
  };
});

const isLegalEventsEnabled = vi.fn(() => true);
vi.mock("./legal-events-config", () => ({
  isLegalEventsEnabled: () => isLegalEventsEnabled(),
}));

import { lookupLegalJudgments } from "./lookup-legal-judgments";
import { lookupMwcWithMeta } from "./mwc-lookup";
import { synthesizeRiskReport } from "./llm-risk-report";
import { runSearchPipeline } from "./search-pipeline";

describe("runSearchPipeline cache + legal degraded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLegalEventsEnabled.mockReturnValue(true);
    vi.mocked(synthesizeRiskReport).mockResolvedValue(baseLlmReport());
    vi.mocked(lookupLegalJudgments).mockResolvedValue({
      events: [],
      registryAsOf: "2026-01-01T00:00:00.000Z",
    });
    getCachedReport.mockResolvedValue(null);
    setCachedReport.mockResolvedValue(undefined);
  });

  it("ignores non-expired degraded cache and re-runs legal lookup", async () => {
    const degradedCached: RiskReport = {
      ...baseLlmReport(),
      official: { mwcMatched: false, legalLookupStatus: "error" },
    };
    getCachedReport.mockResolvedValueOnce(degradedCached);

    const result = await runSearchPipeline({
      matchType: "company_name",
      companyName: "示例裝修有限公司",
    });

    expect(lookupLegalJudgments).toHaveBeenCalled();
    expect(result.cacheHit).toBe(false);
  });

  it("passes degraded cache options when legal lookup fails", async () => {
    vi.mocked(lookupLegalJudgments).mockRejectedValue(new Error("db down"));

    await runSearchPipeline({
      matchType: "company_name",
      companyName: "示例裝修有限公司",
    });

    expect(setCachedReport).toHaveBeenCalledWith(
      supabase,
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        summaryZh: expect.stringContaining(LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX),
        official: expect.objectContaining({ legalLookupStatus: "error" }),
      }),
      {
        ttlMs: LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS,
        skipIfHealthyCacheExists: true,
      },
    );
  });

  it("does not apply degraded cache options when legal lookup ok", async () => {
    isLegalEventsEnabled.mockReturnValue(false);

    await runSearchPipeline({
      matchType: "company_name",
      companyName: "示例裝修有限公司",
    });

    expect(setCachedReport).toHaveBeenCalledWith(
      supabase,
      expect.any(String),
      expect.any(Object),
      expect.any(Object),
      {
        ttlMs: undefined,
        skipIfHealthyCacheExists: false,
      },
    );
  });

  it("does not cache when MWC lookup fails", async () => {
    vi.mocked(lookupMwcWithMeta).mockRejectedValueOnce(
      new Error("mwc_lookup_failed"),
    );

    await expect(
      runSearchPipeline({
        matchType: "company_name",
        companyName: "合成測試有限公司",
      }),
    ).rejects.toThrow("mwc_lookup_failed");

    expect(setCachedReport).not.toHaveBeenCalled();
  });

  it("resolves when cache upsert fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const actual = await vi.importActual<typeof import("./search-cache")>(
      "./search-cache",
    );
    const upsert = vi.fn().mockResolvedValue({
      error: { message: "disk full" },
    });
    const mockSb = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
        upsert,
      })),
    } as unknown as SupabaseClient;
    setCachedReport.mockImplementation((sb, fp, qi, rep, opts) =>
      actual.setCachedReport(mockSb, fp, qi, rep, opts),
    );

    vi.mocked(lookupLegalJudgments).mockRejectedValue(new Error("db down"));

    const result = await runSearchPipeline({
      matchType: "company_name",
      companyName: "示例裝修有限公司",
    });

    expect(result.report.entity.displayName).toBe("示例裝修有限公司");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("search_cache upsert failed"),
    );
  });
});
