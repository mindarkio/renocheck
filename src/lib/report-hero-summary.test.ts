import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import { applyLegalEventFloors } from "./legal-event-calibration";
import type { OfficialLegalEvent } from "./legal-event-schema";
import {
  forumDisputeChip,
  hasForumDisputeSignal,
  hasMatchedLegalEvents,
  heroForumChipTone,
  heroLegalChipTone,
  isLegalSummaryScope,
  legalRecordsChip,
  reportHeroSummaryZh,
  type HeroChipTone,
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

function disputeToneFromReport(report: RiskReport): HeroChipTone {
  const level = report.evaluation.reputationTrack.disputeLevel;
  return level === "severe" || level === "active_concerning"
    ? "warning"
    : "muted";
}

function anyHeroChipAmber(
  report: RiskReport,
  disputeTone: HeroChipTone,
): boolean {
  const forumAmber = heroForumChipTone(report, disputeTone) === "warning";
  const legalChip = legalRecordsChip(report);
  const legalAmber =
    legalChip !== null &&
    heroLegalChipTone(report, disputeTone) === "warning";
  return forumAmber || legalAmber;
}

function withLegalFloors(
  report: RiskReport,
  events: OfficialLegalEvent[],
  boundHitCount = 0,
): RiskReport {
  return applyLegalEventFloors(report, events, boundHitCount);
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

  it("legal: defendant liable employment = warning only when disputeTone warning", () => {
    const defendant = withLegalFloors(
      baseReport({
        official: { mwcMatched: false, legalEvents: [legalEventDefendant] },
      }),
      [legalEventDefendant],
    );
    expect(heroLegalChipTone(defendant, "warning")).toBe("warning");
    expect(heroLegalChipTone(defendant, "muted")).toBe("muted");

    const plaintiff = withLegalFloors(
      baseReport({
        official: { mwcMatched: false, legalEvents: [legalEventPlaintiff] },
        evaluation: {
          ...baseReport().evaluation,
          reputationTrack: {
            disputeLevel: "active_concerning",
            recentDisputeCount: 0,
          },
        },
      }),
      [legalEventPlaintiff],
    );
    expect(heroLegalChipTone(plaintiff, "warning")).toBe("muted");
  });
});

describe("hero chip amber invariant", () => {
  const generatedAt = "2026-01-15T12:00:00.000Z";
  const oldDefendant = {
    ...legalEventDefendant,
    eventDate: "2011-01-01",
  };

  function assertInvariant(report: RiskReport) {
    const disputeTone = disputeToneFromReport(report);
    expect(anyHeroChipAmber(report, disputeTone)).toBe(
      disputeTone === "warning",
    );
  }

  it("legal only — recent defendant", () => {
    const r = withLegalFloors(
      baseReport({
        generatedAt,
        official: { mwcMatched: false, legalEvents: [legalEventDefendant] },
      }),
      [legalEventDefendant],
    );
    assertInvariant(r);
    expect(disputeToneFromReport(r)).toBe("warning");
  });

  it("legal only — defendant 15+ years ago", () => {
    const r = withLegalFloors(
      baseReport({
        generatedAt,
        official: { mwcMatched: false, legalEvents: [oldDefendant] },
      }),
      [oldDefendant],
    );
    assertInvariant(r);
    expect(disputeToneFromReport(r)).not.toBe("warning");
  });

  it("forum historical + defendant 15+ years ago", () => {
    const r = withLegalFloors(
      baseReport({
        generatedAt,
        official: { mwcMatched: false, legalEvents: [oldDefendant] },
        signals: {
          ...baseReport().signals,
          boundHitCount: 1,
          highlights: [
            { summaryZh: "舊提及", url: "https://example.com/old" },
          ],
        },
        evaluation: {
          ...baseReport().evaluation,
          reputationTrack: {
            disputeLevel: "historical_isolated",
            recentDisputeCount: 1,
          },
        },
      }),
      [oldDefendant],
    );
    assertInvariant(r);
  });

  it("forum active + defendant 15+ years ago — legal chip muted", () => {
    const r = withLegalFloors(
      baseReport({
        generatedAt,
        official: { mwcMatched: false, legalEvents: [oldDefendant] },
        signals: {
          ...baseReport().signals,
          boundHitCount: 2,
          highlights: [
            { summaryZh: "近期提及", url: "https://example.com/new" },
          ],
        },
      }),
      [oldDefendant],
    );
    const merged: RiskReport = {
      ...r,
      evaluation: {
        ...r.evaluation,
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 1,
        },
      },
    };
    const disputeTone = disputeToneFromReport(merged);
    expect(disputeTone).toBe("warning");
    expect(heroLegalChipTone(merged, disputeTone)).toBe("muted");
    assertInvariant(merged);
  });

  it("forum active + plaintiff", () => {
    const r = withLegalFloors(
      baseReport({
        generatedAt,
        official: { mwcMatched: false, legalEvents: [legalEventPlaintiff] },
        signals: {
          ...baseReport().signals,
          boundHitCount: 1,
          highlights: [{ summaryZh: "提及", url: "https://example.com/x" }],
        },
        evaluation: {
          ...baseReport().evaluation,
          reputationTrack: {
            disputeLevel: "active_concerning",
            recentDisputeCount: 1,
          },
        },
      }),
      [legalEventPlaintiff],
    );
    assertInvariant(r);
  });

  it("neither forum nor legal signal", () => {
    const r = baseReport({ generatedAt });
    assertInvariant(r);
  });
});

describe("legalRecordsChip dedupe count", () => {
  it("two distinct neutral citations → 2 宗", () => {
    const events = [
      {
        ...legalEventDefendant,
        caseRef: "A/1",
        neutralCitation: "[2024] HKCFI 1",
      },
      {
        ...legalEventDefendant,
        caseRef: "B/1",
        neutralCitation: "[2024] HKCFI 2",
      },
    ];
    const r = baseReport({
      official: { mwcMatched: false, legalEvents: events },
    });
    expect(legalRecordsChip(r)?.label).toBe("公開判詞 · 2 宗");
  });

  it("same neutralCitation → dedupe to 1 宗", () => {
    const events = [
      {
        ...legalEventDefendant,
        caseRef: "HCLA 23/2024",
        neutralCitation: "[2025] HKCFI 633",
      },
      {
        ...legalEventDefendant,
        caseRef: "HCLA 25/2024",
        neutralCitation: "[2025] HKCFI 633",
      },
    ];
    const r = baseReport({
      official: { mwcMatched: false, legalEvents: events },
    });
    expect(legalRecordsChip(r)?.label).toBe("公開判詞 · 1 宗");
  });
});

describe("legal scope off", () => {
  it("no legal chip when legalEvents and legalRegistryAsOf undefined", () => {
    const r = baseReport({ official: { mwcMatched: false } });
    expect(isLegalSummaryScope(r)).toBe(false);
    expect(legalRecordsChip(r)).toBeNull();
  });
});
