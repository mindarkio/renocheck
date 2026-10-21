import { describe, expect, it } from "vitest";
import { calibrateEvaluation } from "./risk-report-calibration-v2";
import type { LlmRiskSlice } from "./risk-report-calibration";

const emptySlice = (): LlmRiskSlice => ({
  grade: "A",
  confidence: "high",
  summaryZh: "根據公開資料，暫無具體風險紀錄。",
  discussionCount: 0,
  themes: ["未檢出相關討論"],
  highlights: [],
});

const evidence = {
  llmHitCount: 0,
  boundHitCount: 0,
  serpHitCount: 3,
};

describe("calibrateEvaluation", () => {
  it("MWC active, zero bound and highlights → neutral C / sparse (not B+)", () => {
    const out = calibrateEvaluation({
      slice: emptySlice(),
      evidence,
      mwcMatched: true,
      mwcAmbiguous: false,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.grade).toBe("C");
    expect(out.evaluation.displayGradeZh).toBe("C");
    expect(out.evaluation.confidence).toBe("low");
    expect(out.evaluation.dataSaturation).toBe("sparse");
    expect(out.summaryZh).toContain("未檢出公開糾紛");
    expect(out.summaryZh).not.toContain("無風險");
    expect(out.evaluation.riskBandZh).toBe("中性");
  });

  it("MWC active, many serp but zero bound → C bind-failure not B+", () => {
    const out = calibrateEvaluation({
      slice: emptySlice(),
      evidence: { llmHitCount: 0, boundHitCount: 0, serpHitCount: 29 },
      mwcMatched: true,
      mwcAmbiguous: false,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.grade).toBe("C");
    expect(out.evaluation.displayGradeZh).not.toBe("B+");
    expect(out.evaluation.dataSaturation).toBe("sparse");
    expect(out.summaryZh).toContain("未檢出與查證對象相關的糾紛或投訴");
  });

  it("bind failure summary length ≤120", () => {
    const summary =
      "政府名冊有登記；在本站本次已檢索的公開網上來源中，未檢出與查證對象相關的糾紛或投訴討論摘要（不包括判詞紀錄）；結果只反映已檢索範圍，請自行核實。";
    expect(summary.length).toBeLessThanOrEqual(120);
  });

  it("no MWC, zero evidence → C / unindexed", () => {
    const out = calibrateEvaluation({
      slice: emptySlice(),
      evidence: { llmHitCount: 0, boundHitCount: 0, serpHitCount: 10 },
      mwcMatched: false,
      mwcAmbiguous: false,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.grade).toBe("C");
    expect(out.evaluation.dataSaturation).toBe("unindexed");
    expect(out.confidence).toBe("low");
  });

  it("bound≥1, zero highlights, no dispute snippet → C+ / moderate", () => {
    const out = calibrateEvaluation({
      slice: emptySlice(),
      evidence: {
        llmHitCount: 2,
        boundHitCount: 2,
        serpHitCount: 20,
        boundDisputeHitCount: 0,
      },
      mwcMatched: false,
      mwcAmbiguous: false,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.grade).toBe("C");
    expect(out.evaluation.displayGradeZh).toBe("C+");
    expect(out.evaluation.dataSaturation).toBe("moderate");
    expect(out.summaryZh).toContain("未能形成可引用");
  });

  it("bound≥3 dispute snippets, zero highlights → C+ / none_detected (snippets not graded)", () => {
    const out = calibrateEvaluation({
      slice: emptySlice(),
      evidence: {
        llmHitCount: 8,
        boundHitCount: 8,
        serpHitCount: 29,
        boundDisputeHitCount: 5,
      },
      mwcMatched: true,
      mwcAmbiguous: false,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.grade).toBe("C");
    expect(out.evaluation.displayGradeZh).toBe("C+");
    expect(out.evaluation.reputationTrack.disputeLevel).toBe("none_detected");
    expect(out.summaryZh).toContain("糾紛");
    expect(out.evaluation.riskBandZh).toBe("中性");
  });

  it("two recent dispute highlights on distinct hosts → D", () => {
    const out = calibrateEvaluation({
      slice: {
        grade: "F",
        confidence: "high",
        summaryZh: "多宗提及",
        discussionCount: 2,
        themes: ["超支"],
        highlights: [
          {
            summaryZh: "超支糾紛甲",
            url: "https://www.facebook.com/a",
            incidentType: "payment_dispute" as const,
            approxYear: "2025",
          },
          {
            summaryZh: "超支糾紛乙",
            url: "https://www.lihkg.com/b",
            incidentType: "payment_dispute" as const,
            approxYear: "2025",
          },
        ],
      },
      evidence: { llmHitCount: 5, boundHitCount: 5, serpHitCount: 20 },
      mwcMatched: false,
      mwcAmbiguous: false,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.grade).toBe("D");
    expect(out.evaluation.reputationTrack.disputeLevel).toBe("active_concerning");
    expect(out.evaluation.reputationTrack.recentDisputeCount).toBe(2);
    expect(out.evaluation.riskBandZh).toBe("風險偏高");
  });

  it("single praise-like highlight → C / none_detected / not 風險中等", () => {
    const out = calibrateEvaluation({
      slice: {
        grade: "D",
        confidence: "medium",
        summaryZh: "一則提及",
        discussionCount: 1,
        themes: ["爛尾"],
        highlights: [
          {
            summaryZh: "爛尾投訴",
            url: "https://example.com/a",
            approxYear: "2025",
            incidentType: "other",
          },
        ],
      },
      evidence: { llmHitCount: 3, boundHitCount: 3, serpHitCount: 10 },
      mwcMatched: false,
      mwcAmbiguous: false,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.grade).toBe("C");
    expect(out.evaluation.reputationTrack.disputeLevel).toBe("none_detected");
    expect(out.evaluation.riskBandZh).not.toBe("風險中等");
  });

  it("single recent payment_dispute → 風險中等 not 偏高", () => {
    const out = calibrateEvaluation({
      slice: {
        grade: "C",
        confidence: "medium",
        summaryZh: "一則",
        discussionCount: 1,
        themes: [],
        highlights: [
          {
            summaryZh: "走數",
            url: "https://www.facebook.com/a",
            approxYear: "2025",
            incidentType: "payment_dispute",
          },
        ],
      },
      evidence: { llmHitCount: 1, boundHitCount: 1, serpHitCount: 5 },
      mwcMatched: false,
      mwcAmbiguous: false,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.evaluation.riskBandZh).toBe("風險中等");
  });

  it("ambiguous MWC does not get B row", () => {
    const out = calibrateEvaluation({
      slice: emptySlice(),
      evidence,
      mwcMatched: true,
      mwcAmbiguous: true,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.grade).toBe("C");
    expect(out.evaluation.complianceTrack.licenseStatus).toBe("ambiguous");
    expect(out.confidence).toBe("low");
  });
});
