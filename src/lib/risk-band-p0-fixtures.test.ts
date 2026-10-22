import { afterEach, describe, expect, it } from "vitest";
import { calibrateEvaluation } from "./risk-report-calibration-v2";
import { capRiskBandZh } from "./risk-band-calibration";
import { forumDisputeChip } from "./report-hero-summary";
import { countBoundDisputeSignals } from "./search-evidence-filter";
import type { WebSearchHit } from "./web-search";
import type { LlmRiskSlice } from "./risk-report-calibration";

const generatedAt = "2026-06-01T00:00:00.000Z";

const praiseHits: WebSearchHit[] = [
  {
    title: "FB",
    url: "https://www.facebook.com/post/1",
    snippet: "XX裝修好專業，溝通順暢，完全冇投訴",
  },
  {
    title: "Threads",
    url: "https://www.threads.net/post/2",
    snippet: "搵XX做冇爛尾，推薦",
  },
  {
    title: "LIHKG",
    url: "https://www.lihkg.com/thread/3",
    snippet: "XX回應事件：此舉無道德",
  },
];

const praiseHighlights = [
  {
    summaryZh: "XX裝修好專業，溝通順暢，完全冇投訴",
    url: "https://www.facebook.com/post/1",
    incidentType: "communication" as const,
  },
  {
    summaryZh: "搵XX做冇爛尾，推薦",
    url: "https://www.threads.net/post/2",
    incidentType: "other" as const,
  },
  {
    summaryZh: "溝通",
    url: "https://www.lihkg.com/thread/3",
    incidentType: "other" as const,
  },
];

function calibrateCaseA(highlights: LlmRiskSlice["highlights"]) {
  return calibrateEvaluation({
    slice: {
      grade: "D",
      confidence: "high",
      summaryZh: "討論",
      discussionCount: highlights.length,
      themes: ["溝通"],
      highlights,
    },
    evidence: {
      llmHitCount: 4,
      boundHitCount: 3,
      serpHitCount: 20,
      boundDisputeHitCount: countBoundDisputeSignals(praiseHits),
      boundPraiseHitCount: 2,
    },
    mwcMatched: false,
    mwcAmbiguous: false,
    generatedAt,
  });
}

describe("P0 Case A — praise hits false-positive keywords", () => {
  it("zero highlights → 中性 / none_detected", () => {
    const out = calibrateCaseA([]);
    expect(out.evaluation.riskBandZh).not.toBe("風險偏高");
    expect(out.evaluation.riskBandZh).not.toBe("風險中等");
    expect(["中性", "未見負面摘要"]).toContain(out.evaluation.riskBandZh);
    expect(out.evaluation.reputationTrack.disputeLevel).toBe("none_detected");
  });

  it("three praise highlights → not elevated band", () => {
    const out = calibrateCaseA(praiseHighlights);
    expect(out.evaluation.riskBandZh).not.toBe("風險偏高");
    expect(out.evaluation.riskBandZh).not.toBe("風險中等");
    expect(out.evaluation.reputationTrack.disputeLevel).toBe("none_detected");
    expect(out.evaluation.reputationTrack.recentDisputeCount).toBe(0);
  });

  it("forum chip 公開討論：未檢出 when only praise highlights", () => {
    const out = calibrateCaseA(praiseHighlights);
    const chip = forumDisputeChip({
      reportVersion: "2.7.0",
      entity: {
        displayName: "XX",
        matchType: "company_name",
        queryEcho: "XX",
        searchLabelUsed: "XX",
        nameAlignment: "user_only",
      },
      grade: out.grade,
      confidence: out.confidence,
      evaluation: out.evaluation,
      summaryZh: out.summaryZh,
      official: { mwcMatched: false },
      signals: {
        discussionCount: 3,
        themes: [],
        highlights: praiseHighlights,
        boundHitCount: 3,
        retrievalEvidence: [],
        contractChecklist: ["?"],
        actionableClauses: [],
      },
      disclaimerVersion: "1.2.1",
      generatedAt,
    });
    expect(chip.label).toBe("公開討論：未檢出");
  });
});

describe("P0 regression — real dispute highlights", () => {
  afterEach(() => {
    delete process.env.RISK_BAND_MAX;
  });

  const dispute = (url: string, summaryZh: string) => ({
    summaryZh,
    url,
    incidentType: "payment_dispute" as const,
    approxYear: "2025",
  });

  it("three recent payment_dispute on three hosts → 風險偏高", () => {
    const highlights = [
      dispute("https://www.facebook.com/a", "走數苦主帖一"),
      dispute("https://www.lihkg.com/b", "走數苦主帖二"),
      dispute("https://www.threads.net/c", "走數苦主帖三"),
    ];
    const out = calibrateEvaluation({
      slice: {
        grade: "E",
        confidence: "high",
        summaryZh: "多宗",
        discussionCount: 3,
        themes: ["走數"],
        highlights,
      },
      evidence: {
        llmHitCount: 3,
        boundHitCount: 3,
        serpHitCount: 10,
      },
      mwcMatched: false,
      mwcAmbiguous: false,
      generatedAt,
    });
    expect(out.evaluation.riskBandZh).toBe("風險偏高");
    expect(out.evaluation.reputationTrack.recentDisputeCount).toBe(3);
  });

  it("RISK_BAND_MAX=風險中等 caps regression high band", () => {
    process.env.RISK_BAND_MAX = "風險中等";
    const highlights = [
      dispute("https://www.facebook.com/a", "走數苦主帖一"),
      dispute("https://www.lihkg.com/b", "走數苦主帖二"),
      dispute("https://www.threads.net/c", "走數苦主帖三"),
    ];
    const out = calibrateEvaluation({
      slice: {
        grade: "E",
        confidence: "high",
        summaryZh: "多宗",
        discussionCount: 3,
        themes: ["走數"],
        highlights,
      },
      evidence: {
        llmHitCount: 3,
        boundHitCount: 3,
        serpHitCount: 10,
      },
      mwcMatched: false,
      mwcAmbiguous: false,
      generatedAt,
    });
    // Cap is applied at serve time; the stored evaluation stays uncapped.
    expect(out.evaluation.riskBandZh).toBe("風險偏高");
    expect(capRiskBandZh(out.evaluation.riskBandZh)).toBe("風險中等");
  });
});
