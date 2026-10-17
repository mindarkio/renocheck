import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import {
  forumDisputeChip,
  hasForumDisputeSignal,
  hasMatchedLegalEvents,
  legalRecordsChip,
  reportHeroSummaryZh,
} from "./report-hero-summary";
import type { RiskReport } from "./report-schema";

function baseReport(overrides: Partial<RiskReport> = {}): RiskReport {
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
      displayName: "測試",
      matchType: "company_name",
      queryEcho: "測試",
      searchLabelUsed: "測試",
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "low",
    evaluation: {
      ...evaluation,
      riskBandZh: "中性",
      reputationTrack: {
        disputeLevel: "none_detected",
        recentDisputeCount: 0,
      },
    },
    summaryZh: "LLM 原文不應出現",
    official: { mwcMatched: false, legalEvents: [] },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      contractChecklist: ["?"],
      actionableClauses: [],
      boundHitCount: 0,
    },
    disclaimerVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("reportHeroSummaryZh", () => {
  it("uses LLM summary when legal scope off", () => {
    const r = baseReport({
      official: { mwcMatched: false },
      summaryZh: "保留 LLM",
    });
    expect(reportHeroSummaryZh(r)).toBe("保留 LLM");
  });

  it("legal only copy", () => {
    const r = baseReport({
      official: {
        mwcMatched: false,
        legalEvents: [
          {
            sourceType: "court_judgment",
            caseRef: "X",
            court: "C",
            eventDate: "2021-01-01",
            judgmentCategory: "renovation_engineering_civil",
            partyRole: "defendant",
            hearingKeyPointsZh: ["a"],
            sourceUrl: "https://example.com",
            matchReasonZh: "m",
          },
        ],
      },
      evaluation: {
        ...baseReport().evaluation,
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 0,
        },
      },
    });
    expect(hasMatchedLegalEvents(r)).toBe(true);
    expect(hasForumDisputeSignal(r)).toBe(false);
    expect(reportHeroSummaryZh(r)).toContain("公開判詞紀錄");
    expect(reportHeroSummaryZh(r)).toContain("未檢出相關的公開討論");
  });

  it("forum only copy", () => {
    const r = baseReport({
      signals: {
        ...baseReport().signals,
        boundHitCount: 2,
        highlights: [
          {
            summaryZh: "糾紛提及",
            url: "https://example.com/post",
          },
        ],
      },
      evaluation: {
        ...baseReport().evaluation,
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 1,
        },
      },
    });
    expect(reportHeroSummaryZh(r)).toContain("討論摘要");
    expect(reportHeroSummaryZh(r)).toContain("未見可對照之案件");
  });

  it("both copy", () => {
    const r = baseReport({
      official: {
        mwcMatched: false,
        legalEvents: [
          {
            sourceType: "court_judgment",
            caseRef: "X",
            court: "C",
            eventDate: "2021-01-01",
            judgmentCategory: "small_claims_debt",
            partyRole: "defendant",
            hearingKeyPointsZh: ["a"],
            sourceUrl: "https://example.com",
            matchReasonZh: "m",
          },
        ],
      },
      signals: {
        ...baseReport().signals,
        boundHitCount: 1,
        highlights: [
          {
            summaryZh: "投訴",
            url: "https://example.com/p",
          },
        ],
      },
    });
    expect(reportHeroSummaryZh(r)).toContain("同時檢出");
  });

  it("legal chip shows count; forum chip muted when only legal", () => {
    const r = baseReport({
      official: {
        mwcMatched: false,
        legalEvents: [
          {
            sourceType: "court_judgment",
            caseRef: "X",
            court: "C",
            eventDate: "2021-01-01",
            judgmentCategory: "renovation_engineering_civil",
            partyRole: "defendant",
            hearingKeyPointsZh: ["a"],
            sourceUrl: "https://example.com",
            matchReasonZh: "m",
          },
        ],
      },
      evaluation: {
        ...baseReport().evaluation,
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 0,
        },
      },
    });
    expect(legalRecordsChip(r)?.label).toBe("公開判詞 · 1 宗");
    expect(forumDisputeChip(r).label).toBe("網上投訴");
  });
});
