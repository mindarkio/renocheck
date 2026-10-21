import { afterEach, describe, expect, it, vi } from "vitest";
import {
  capRiskBandZh,
  resetWarnedInvalidCapForTests,
  resolveRiskBandZh,
} from "./risk-band-calibration";

const generatedAt = "2026-06-01T00:00:00.000Z";

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
        generatedAt,
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
        generatedAt,
      }).riskBandZh,
    ).toBe("風險偏高");
  });

  it("bound dispute snippets alone do not → 風險中等", () => {
    expect(
      resolveRiskBandZh({
        boundHitCount: 2,
        boundDisputeHitCount: 3,
        boundPraiseHitCount: 0,
        disputeLevel: "none_detected",
        highlights: [],
        overallGrade: "C",
        generatedAt,
      }).riskBandZh,
    ).toBe("中性");
  });

  it("praise only → 未見負面摘要 with detail when single hit", () => {
    const out = resolveRiskBandZh({
      boundHitCount: 1,
      boundDisputeHitCount: 0,
      boundPraiseHitCount: 1,
      disputeLevel: "none_detected",
      highlights: [],
      overallGrade: "C",
      generatedAt,
    });
    expect(out.riskBandZh).toBe("未見負面摘要");
    expect(out.riskBandDetailZh).toBe("公開讚揚較少");
  });

  it("bound but no praise or dispute highlights → 中性", () => {
    expect(
      resolveRiskBandZh({
        boundHitCount: 3,
        boundDisputeHitCount: 0,
        boundPraiseHitCount: 0,
        disputeLevel: "none_detected",
        highlights: [],
        overallGrade: "C",
        generatedAt,
      }).riskBandZh,
    ).toBe("中性");
  });

  it("two recent payment_dispute highlights on distinct hosts → 風險偏高", () => {
    const h = {
      summaryZh: "走數苦主",
      url: "https://www.facebook.com/a",
      incidentType: "payment_dispute" as const,
      approxYear: "2025",
    };
    expect(
      resolveRiskBandZh({
        boundHitCount: 3,
        boundDisputeHitCount: 0,
        boundPraiseHitCount: 0,
        disputeLevel: "active_concerning",
        highlights: [h, { ...h, url: "https://www.lihkg.com/b" }],
        overallGrade: "D",
        generatedAt,
      }).riskBandZh,
    ).toBe("風險偏高");
  });

  it("two disputes same host → 風險中等 not 偏高", () => {
    const h = {
      summaryZh: "走數",
      url: "https://www.facebook.com/a",
      incidentType: "payment_dispute" as const,
      approxYear: "2025",
    };
    expect(
      resolveRiskBandZh({
        boundHitCount: 2,
        boundDisputeHitCount: 0,
        boundPraiseHitCount: 0,
        disputeLevel: "active_concerning",
        highlights: [h, { ...h, url: "https://www.facebook.com/b" }],
        overallGrade: "C",
        generatedAt,
      }).riskBandZh,
    ).toBe("風險中等");
  });
});

describe("capRiskBandZh", () => {
  afterEach(() => {
    delete process.env.RISK_BAND_MAX;
    resetWarnedInvalidCapForTests();
  });

  it("caps 風險偏高 to 風險中等 when env set", () => {
    process.env.RISK_BAND_MAX = "風險中等";
    expect(capRiskBandZh("風險偏高")).toBe("風險中等");
    expect(capRiskBandZh("風險中等")).toBe("風險中等");
  });

  it("O9: invalid RISK_BAND_MAX logs once and leaves band unchanged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.RISK_BAND_MAX = "high";
    expect(capRiskBandZh("風險偏高")).toBe("風險偏高");
    expect(capRiskBandZh("風險偏高")).toBe("風險偏高");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({ event: "risk_band_max_invalid" }),
    );
    warn.mockRestore();
  });
});
