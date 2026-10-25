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
    fetchWebSearchHitsForEntity: vi
      .fn()
      .mockResolvedValue({ hits: [], queriesCompleted: 1 }),
    fetchSerpOrganicHits: vi.fn(),
    mergeWebSearchHits: vi.fn(),
    buildBrandHostForumQuery: vi.fn(),
  };
});

vi.mock("./llm-model", () => ({
  isLlmConfigured: () => true,
}));

vi.mock("./service-status", () => ({
  getServiceStatus: vi.fn(() => ({ paused: false, reason: null })),
}));

vi.mock("./mwc-lookup", () => ({
  lookupMwcWithMeta: vi.fn().mockResolvedValue({
    row: null,
    ambiguous: false,
  }),
}));

const { lookupCompaniesRegistryForSearch } = vi.hoisted(() => ({
  lookupCompaniesRegistryForSearch: vi.fn().mockResolvedValue({
    lookupStatus: "skipped",
    retrievedAt: "2026-10-18T12:00:00.000Z",
    hints: [],
    icrisHomeUrl: "https://www.e-services.cr.gov.hk/",
  }),
}));

vi.mock("./cr-registry-lookup", () => ({
  lookupCompaniesRegistryForSearch,
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
import {
  LLM_RESERVE_MS,
  PIPELINE_BUDGET_MS,
  runSearchPipeline,
} from "./search-pipeline";
import { SearchPipelineError } from "./search-pipeline-error";
import { getServiceStatus } from "./service-status";
import {
  buildBrandHostForumQuery,
  fetchSerpOrganicHits,
  fetchWebSearchHitsForEntity,
  mergeWebSearchHits,
} from "./web-search";

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
    vi.mocked(getServiceStatus).mockReturnValue({ paused: false, reason: null });
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

  it("passes degraded cache options when CR lookup times out", async () => {
    lookupCompaniesRegistryForSearch.mockResolvedValueOnce({
      lookupStatus: "timeout",
      retrievedAt: "2026-10-18T12:00:00.000Z",
      hints: [],
      icrisHomeUrl: "https://www.e-services.cr.gov.hk/",
    });

    await runSearchPipeline({
      matchType: "company_name",
      companyName: "示例裝修有限公司",
    });

    expect(setCachedReport).toHaveBeenCalledWith(
      supabase,
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        official: expect.objectContaining({
          companiesRegistry: expect.objectContaining({
            lookupStatus: "timeout",
          }),
        }),
      }),
      {
        ttlMs: LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS,
        skipIfHealthyCacheExists: true,
      },
    );
  });

  it("ignores non-expired CR-degraded cache and re-runs pipeline", async () => {
    const crDegradedCached: RiskReport = {
      ...baseLlmReport(),
      official: {
        mwcMatched: false,
        legalLookupStatus: "ok",
        companiesRegistry: {
          lookupStatus: "timeout",
          retrievedAt: "2026-10-18T12:00:00.000Z",
          hints: [],
          icrisHomeUrl: "https://www.e-services.cr.gov.hk/",
        },
      },
    };
    getCachedReport.mockResolvedValueOnce(crDegradedCached);

    const result = await runSearchPipeline({
      matchType: "company_name",
      companyName: "示例裝修有限公司",
    });

    expect(result.cacheHit).toBe(false);
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

  it("does not cache a neutral report when every search source fails", async () => {
    vi.mocked(fetchWebSearchHitsForEntity).mockResolvedValueOnce({
      hits: [],
      queriesCompleted: 0,
    });

    let caught: unknown;
    try {
      await runSearchPipeline({
        matchType: "company_name",
        companyName: "示例裝修有限公司",
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SearchPipelineError);
    expect(caught).toMatchObject({ code: "serp_failed" });
    expect(synthesizeRiskReport).not.toHaveBeenCalled();
    expect(setCachedReport).not.toHaveBeenCalled();
    expect(logSearchEvent).not.toHaveBeenCalled();
  });

  it("serves a cached report while the service is paused", async () => {
    getCachedReport.mockResolvedValueOnce(baseLlmReport());
    vi.mocked(getServiceStatus).mockReturnValue({
      paused: true,
      reason: "gemini_quota_day",
    });

    const result = await runSearchPipeline({
      matchType: "company_name",
      companyName: "示例裝修有限公司",
    });

    expect(result.cacheHit).toBe(true);
    expect(fetchWebSearchHitsForEntity).not.toHaveBeenCalled();
    expect(synthesizeRiskReport).not.toHaveBeenCalled();
  });

  it("passes a valid anon id into the search event and drops it for ZZQ probes", async () => {
    getCachedReport.mockResolvedValue(baseLlmReport());
    const anonId = "12345678-1234-4234-8234-123456789abc";
    await runSearchPipeline(
      { matchType: "company_name", companyName: "示例裝修有限公司" },
      { anonId },
    );
    expect(logSearchEvent).toHaveBeenCalledWith(
      supabase,
      expect.any(String),
      true,
      anonId,
    );
    expect(synthesizeRiskReport).not.toHaveBeenCalled();

    logSearchEvent.mockClear();
    await runSearchPipeline(
      { matchType: "company_name", companyName: "ZZQ_probe 示例" },
      { anonId },
    );
    expect(logSearchEvent).toHaveBeenCalledWith(
      supabase,
      expect.any(String),
      true,
      null,
    );
  });

  it("returns service_paused on a cache miss without calling search or the LLM", async () => {
    vi.mocked(getServiceStatus).mockReturnValue({
      paused: true,
      reason: "manual",
    });

    let caught: unknown;
    try {
      await runSearchPipeline({
        matchType: "company_name",
        companyName: "示例裝修有限公司",
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SearchPipelineError);
    expect(caught).toMatchObject({ code: "service_paused" });
    expect(fetchWebSearchHitsForEntity).not.toHaveBeenCalled();
    expect(synthesizeRiskReport).not.toHaveBeenCalled();
    expect(setCachedReport).not.toHaveBeenCalled();
    expect(lookupMwcWithMeta).not.toHaveBeenCalled();
    expect(logSearchEvent).not.toHaveBeenCalled();
  });

  it("caches a report when every query fails but the brand retry succeeds", async () => {
    vi.mocked(fetchWebSearchHitsForEntity).mockResolvedValueOnce({
      hits: [],
      queriesCompleted: 0,
    });
    vi.mocked(buildBrandHostForumQuery).mockReturnValueOnce('site "源始"');
    vi.mocked(fetchSerpOrganicHits).mockResolvedValueOnce([
      {
        title: "討論",
        url: "https://lihkg.com/thread/1",
        snippet: "裝修討論",
      },
    ]);
    vi.mocked(mergeWebSearchHits).mockReturnValueOnce([
      {
        title: "討論",
        url: "https://lihkg.com/thread/1",
        snippet: "裝修討論",
      },
    ]);

    const result = await runSearchPipeline({
      matchType: "company_name",
      companyName: "源始（國際）設計及裝修公司",
    });

    expect(buildBrandHostForumQuery).toHaveBeenCalled();
    expect(fetchSerpOrganicHits).toHaveBeenCalled();
    expect(synthesizeRiskReport).toHaveBeenCalled();
    expect(setCachedReport).toHaveBeenCalled();
    expect(result.cacheHit).toBe(false);
  });

  it("hides question-only links without changing the L1 grade inputs", async () => {
    const questions = [
      {
        title: "有否人使用過齊來設計居+屋Dimensions Interiors 效果如何？",
        url: "https://www.facebook.com/groups/a/posts/1",
        snippet: "想請教",
      },
      {
        title: "想請教大家齊來設計有人幫襯過嘛？有任何後續",
        url: "https://www.facebook.com/groups/a/posts/2",
        snippet: "",
      },
      {
        title: "想全屋裝修水電做。但係私想分開做，唔洗啲咩特別design",
        url: "https://www.facebook.com/groups/a/posts/3",
        snippet: "群組有人提過齊來設計",
      },
      {
        title: "1. Homic Décor. 居屋・舊屋 2. 翻新齊來設計居+屋",
        url: "https://www.facebook.com/groups/a/posts/4",
        snippet: "",
      },
    ];
    vi.mocked(fetchWebSearchHitsForEntity).mockResolvedValueOnce({
      hits: questions,
      queriesCompleted: 1,
    });

    const result = await runSearchPipeline({
      matchType: "company_name",
      companyName: "齊來設計",
    });

    expect(synthesizeRiskReport).toHaveBeenCalledWith(
      expect.objectContaining({
        webHits: questions,
        boundHitCount: questions.length,
      }),
    );
    expect(result.report.signals.boundHitCount).toBe(questions.length);
    expect(result.report.signals.retrievalEvidence).toEqual([]);
    expect(result.report.grade).toBe("C");
    expect(result.report.evaluation.displayGradeZh).toBe("C+");
    expect(result.report.evaluation.dataSaturation).toBe("moderate");
    expect(result.report.evaluation.riskBandZh).toBe("中性");
    expect(result.report.summaryZh).toBe(
      "根據本次可檢索的公開來源，已確認與查詢字串相關的來源，但未能形成可引用的討論摘要，請自行核實。",
    );
  });

  it("keeps a dispute link and still sends the question hits to the LLM", async () => {
    const hits = [
      {
        title: "齊來設計裝修爛尾，訂金收咗就失聯",
        url: "https://www.lihkg.com/thread/9",
        snippet: "苦主分享",
      },
      {
        title: "有否人使用過齊來設計居+屋Dimensions Interiors 效果如何？",
        url: "https://www.facebook.com/groups/a/posts/1",
        snippet: "",
      },
    ];
    vi.mocked(fetchWebSearchHitsForEntity).mockResolvedValueOnce({
      hits,
      queriesCompleted: 1,
    });

    const result = await runSearchPipeline({
      matchType: "company_name",
      companyName: "齊來設計",
    });

    expect(vi.mocked(synthesizeRiskReport).mock.calls[0]?.[0].webHits).toHaveLength(
      2,
    );
    expect(result.report.signals.boundHitCount).toBe(2);
    expect(result.report.signals.retrievalEvidence.map((e) => e.url)).toEqual([
      "https://www.lihkg.com/thread/9",
    ]);
    expect(result.report.grade).toBe("C");
  });

  it("keeps a cited question URL in the capped link list", async () => {
    const disputes = Array.from({ length: 10 }, (_, i) => ({
      title: `齊來設計爛尾 個案${i}`,
      url: `https://www.lihkg.com/thread/${i}`,
      snippet: "苦主分享",
    }));
    const cited = {
      title: "有否人使用過齊來設計居+屋Dimensions Interiors 效果如何？",
      url: "https://www.facebook.com/groups/a/posts/1",
      snippet: "",
    };
    vi.mocked(fetchWebSearchHitsForEntity).mockResolvedValueOnce({
      hits: [...disputes, cited],
      queriesCompleted: 1,
    });
    const llm = baseLlmReport();
    vi.mocked(synthesizeRiskReport).mockResolvedValueOnce({
      ...llm,
      signals: {
        ...llm.signals,
        discussionCount: 1,
        highlights: [
          {
            summaryZh: "合成摘要：留言指訂金糾紛",
            url: cited.url,
            incidentType: "payment_dispute",
            approxYear: "2026",
          },
        ],
      },
    });

    const result = await runSearchPipeline({
      matchType: "company_name",
      companyName: "齊來設計",
    });

    const urls = result.report.signals.retrievalEvidence.map((e) => e.url);
    expect(urls).toHaveLength(8);
    expect(urls).toContain(cited.url);
    expect(result.report.signals.boundHitCount).toBe(11);
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

describe("runSearchPipeline whole-pipeline deadline (PR24 S1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(synthesizeRiskReport).mockResolvedValue(baseLlmReport());
    vi.mocked(lookupLegalJudgments).mockResolvedValue({
      events: [],
      registryAsOf: "2026-01-01T00:00:00.000Z",
    });
    getCachedReport.mockResolvedValue(null);
  });

  it("bounds SERP by deadline − LLM reserve and passes an abort signal to the LLM", async () => {
    const t0 = Date.now();
    await runSearchPipeline({
      matchType: "company_name",
      companyName: "示例裝修有限公司",
    });
    const serpOpts = vi.mocked(fetchWebSearchHitsForEntity).mock.calls[0]?.[1];
    expect(serpOpts?.deadlineMs).toBeGreaterThanOrEqual(
      t0 + PIPELINE_BUDGET_MS - LLM_RESERVE_MS,
    );
    expect(serpOpts?.deadlineMs).toBeLessThanOrEqual(
      Date.now() + PIPELINE_BUDGET_MS - LLM_RESERVE_MS,
    );
    const llmArgs = vi.mocked(synthesizeRiskReport).mock.calls[0]?.[0];
    expect(llmArgs?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(PIPELINE_BUDGET_MS).toBeLessThanOrEqual(50_000);
  });
});
