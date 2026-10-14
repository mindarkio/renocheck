import { describe, expect, it } from "vitest";
import { resolveRiskBandZh } from "./risk-band-calibration";

describe("resolveRiskBandZh", () => {
  it("bound=0 → 中性 even if severe disputeLevel", () => {
    expect(
      resolveRiskBandZh({
        boundHitCount: 0,
        boundDisputeHitCount: 0,
        boundPraiseHitCount: 0,
        disputeLevel: "severe",
        highlights: [],
        overallGrade: "F",
      }).riskBandZh,
    ).toBe("中性");
  });

  it("severe / F → 風險偏高", () => {
    expect(
      resolveRiskBandZh({
        boundHitCount: 5,
        boundDisputeHitCount: 5,
        boundPraiseHitCount: 0,
        disputeLevel: "severe",
        highlights: [],
        overallGrade: "F",
      }).riskBandZh,
    ).toBe("風險偏高");
  });

  it("dispute bound without severe → 風險中等", () => {
    expect(
      resolveRiskBandZh({
        boundHitCount: 2,
        boundDisputeHitCount: 1,
        boundPraiseHitCount: 0,
        disputeLevel: "none_detected",
        highlights: [],
        overallGrade: "C",
      }).riskBandZh,
    ).toBe("風險中等");
  });

  it("praise only → 未見負面摘要 with detail when single hit", () => {
    const out = resolveRiskBandZh({
      boundHitCount: 1,
      boundDisputeHitCount: 0,
      boundPraiseHitCount: 1,
      disputeLevel: "none_detected",
      highlights: [],
      overallGrade: "C",
    });
    expect(out.riskBandZh).toBe("未見負面摘要");
    expect(out.riskBandDetailZh).toBe("公開讚揚較少");
  });

  it("bound but no praise or dispute → 中性", () => {
    expect(
      resolveRiskBandZh({
        boundHitCount: 3,
        boundDisputeHitCount: 0,
        boundPraiseHitCount: 0,
        disputeLevel: "none_detected",
        highlights: [],
        overallGrade: "C",
      }).riskBandZh,
    ).toBe("中性");
  });
});
