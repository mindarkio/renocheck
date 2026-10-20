import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import {
  forumDisputeChip,
  hasForumDisputeSignal,
  hasMatchedLegalEvents,
  heroForumChipTone,
  heroLegalChipTone,
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

const legalEventDefendant = {
  sourceType: "court_judgment" as const,
  caseRef: "HCLA 1/2024",
  court: "高院",
  eventDate: "2024-01-01",
  judgmentCategory: "employment_renovation" as const,
  partyRole: "defendant" as const,
  outcomeHint: "defendant_liable" as const,
  hearingKeyPointsZh: ["合成"],
  sourceUrl: "https://example.com/j",
  matchReasonZh: "合成",
};

const legalEventPlaintiff = {
  ...legalEventDefendant,
  partyRole: "plaintiff" as const,
  outcomeHint: undefined,
  judgmentCategory: "other_civil" as const,
};

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
        legalEvents: [legalEventDefendant],
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
        legalEvents: [legalEventDefendant],
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
});

describe("hero chips — four quadrants (labels)", () => {
  it("neither: 公開討論未檢出 + 判詞庫未對照", () => {
    const r = baseReport();
    expect(forumDisputeChip(r).label).toBe("公開討論：未檢出");
    expect(legalRecordsChip(r)?.label).toBe("判詞庫未對照");
  });

  it("forum only", () => {
    const r = baseReport({
      signals: {
        ...baseReport().signals,
        boundHitCount: 1,
        highlights: [{ summaryZh: "提及", url: "https://example.com/x" }],
      },
      evaluation: {
        ...baseReport().evaluation,
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 2,
        },
      },
    });
    expect(forumDisputeChip(r).label).toBe("近期糾紛提及 · 2 則");
    expect(legalRecordsChip(r)?.label).toBe("判詞庫未對照");
  });

  it("legal only", () => {
    const r = baseReport({
      official: { mwcMatched: false, legalEvents: [legalEventDefendant] },
      evaluation: {
        ...baseReport().evaluation,
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 0,
        },
      },
    });
    expect(forumDisputeChip(r).label).toBe("公開討論：未檢出");
    expect(legalRecordsChip(r)?.label).toBe("公開判詞 · 1 宗");
  });

  it("both", () => {
    const r = baseReport({
      official: { mwcMatched: false, legalEvents: [legalEventDefendant] },
      signals: {
        ...baseReport().signals,
        boundHitCount: 1,
        highlights: [{ summaryZh: "投訴", url: "https://example.com/p" }],
      },
      evaluation: {
        ...baseReport().evaluation,
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 1,
        },
      },
    });
    expect(forumDisputeChip(r).label).toBe("近期糾紛提及 · 1 則");
    expect(legalRecordsChip(r)?.label).toBe("公開判詞 · 1 宗");
  });
});

describe("hero chip tones", () => {
  it("forum with signal uses disputeTone; without signal muted", () => {
    const quiet = baseReport();
    expect(heroForumChipTone(quiet, "warning")).toBe("muted");
    const loud = baseReport({
      signals: {
        ...baseReport().signals,
        highlights: [{ summaryZh: "x", url: "https://example.com" }],
      },
    });
    expect(heroForumChipTone(loud, "warning")).toBe("warning");
    expect(heroForumChipTone(loud, "muted")).toBe("muted");
  });

  it("legal: defendant liable employment = warning; plaintiff = muted", () => {
    const defendant = baseReport({
      official: { mwcMatched: false, legalEvents: [legalEventDefendant] },
    });
    expect(heroLegalChipTone(defendant)).toBe("warning");

    const plaintiff = baseReport({
      official: { mwcMatched: false, legalEvents: [legalEventPlaintiff] },
      evaluation: {
        ...baseReport().evaluation,
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 0,
        },
      },
    });
    expect(heroLegalChipTone(plaintiff)).toBe("muted");
  });
});
