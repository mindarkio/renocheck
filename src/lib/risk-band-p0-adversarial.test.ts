import { afterEach, describe, expect, it } from "vitest";
import {
  countDistinctHosts,
  ratedDisputeHighlights,
  siteKeyFromUrl,
  snippetHasDisputeKeyword,
} from "./dispute-signals";
import { countBoundPraiseSignals } from "./search-evidence-filter";
import { calibrateEvaluation } from "./risk-report-calibration-v2";
import { applyRiskBandMaxCapToReport } from "./risk-band-calibration";
import type { RiskReport } from "./report-schema";

const G = "2026-06-01T00:00:00.000Z";
const d = (url: string, summaryZh: string, approxYear = "2025") => ({
  summaryZh,
  url,
  incidentType: "payment_dispute" as const,
  approxYear,
});
function band(
  highlights: ReturnType<typeof d>[],
  extra: Partial<Parameters<typeof calibrateEvaluation>[0]["evidence"]> = {},
) {
  return calibrateEvaluation({
    slice: { grade: "C", confidence: "medium", summaryZh: "x", discussionCount: highlights.length, themes: [], highlights },
    evidence: { llmHitCount: Math.max(1, highlights.length), boundHitCount: 5, serpHitCount: 10, ...extra },
    mwcMatched: false,
    mwcAmbiguous: false,
    generatedAt: G,
  }).evaluation;
}

describe("negation window (display count)", () => {
  it.each([
    ["無端走數", true], ["無良商家走數", true], ["凇野走數", true], ["撒野走數", true],
    ["唔係唔會走數", true], ["唔係冇投訴", true], ["並非零投訴", true], ["零星投訴", true],
    ["無數投訴", true], ["無法投訴", true], ["走😡數", true], ["走 數", true], ["走　數", true],
    ["投诉", true], ["纠纷", true], ["走数", true],
    ["完全冇投訴", false], ["零投訴", false], ["冇人投訴", false], ["冇😊😊投訴", false],
    ["沒有爛尾", false], ["唔會中伏", false], ["一啷冇問題…", false],
  ])("%s → %s", (text, expected) => {
    expect(snippetHasDisputeKeyword(text)).toBe(expected);
  });

  it("negated praise is not praise", () => {
    for (const s of ["唔專業", "不推荐", "好唔滿意，拖工兼走數", "冇讚"]) {
      expect(countBoundPraiseSignals([{ title: "", url: "https://a.com", snippet: s }])).toBe(0);
    }
  });
});

describe("site key", () => {
  it("folds subdomains and aliases", () => {
    expect(siteKeyFromUrl("https://m.facebook.com/a")).toBe("facebook.com");
    expect(siteKeyFromUrl("https://www.facebook.com/a")).toBe("facebook.com");
    expect(siteKeyFromUrl("https://lih.kg/1")).toBe("lihkg.com");
    expect(siteKeyFromUrl("https://hk.news.yahoo.com/x")).toBe("yahoo.com");
    expect(siteKeyFromUrl("https://www.discuss.com.hk/x")).toBe("discuss.com.hk");
    expect(
      countDistinctHosts([d("https://www.facebook.com/a", "甲"), d("https://m.facebook.com/b", "乙")]),
    ).toBe(1);
  });
});

describe("偏高 / severe corroboration", () => {
  it("3 disputes on one site → 風險中等 (not severe/偏高)", () => {
    const e = band([d("https://www.facebook.com/a", "走數甲"), d("https://www.facebook.com/b", "走數乙"), d("https://www.facebook.com/c", "走數丙")]);
    expect(e.riskBandZh).toBe("風險中等");
    expect(e.reputationTrack.disputeLevel).not.toBe("severe");
  });
  it("3 highlights on the same URL count once", () => {
    const e = band([d("https://lihkg.com/t/1", "走數甲"), d("https://lihkg.com/t/1?page=2", "走數乙"), d("https://lihkg.com/t/1/", "走數丙")]);
    expect(e.reputationTrack.recentDisputeCount).toBe(1);
    expect(e.riskBandZh).toBe("風險中等");
  });
  it("www vs m.facebook / lihkg vs lih.kg are one site", () => {
    expect(band([d("https://www.facebook.com/a", "走數甲"), d("https://m.facebook.com/b", "走數乙")]).riskBandZh).toBe("風險中等");
    expect(band([d("https://lihkg.com/t/1", "走數甲"), d("https://lih.kg/2", "走數乙")]).riskBandZh).toBe("風險中等");
  });
  it("syndicated story with differently worded summaries → 1 rated (by source title)", () => {
    const T = "裝修公司拖欠工人薪金 勞處介入";
    const e = band(
      [d("https://www.hket.com/a", "裝修公司被指拖欠工人薪金"), d("https://news.mingpao.com/b", "明報：裝修公司拖欠工人薪金"), d("https://hk.news.yahoo.com/c", "有裝修公司被揭欠薪")],
      { sourceTitles: { "https://www.hket.com/a": `${T} - 香港經濟日報`, "https://news.mingpao.com/b": `${T}｜明報`, "https://hk.news.yahoo.com/c": T } },
    );
    expect(e.reputationTrack.recentDisputeCount).toBe(1);
    expect(e.riskBandZh).toBe("風險中等");
  });
  it("future year is not recent", () => {
    expect(ratedDisputeHighlights([d("https://a.com/1", "走數", "2099")], G)).toHaveLength(0);
  });
  it("regression: 3 sites, distinct stories → 風險偏高", () => {
    expect(band([d("https://www.facebook.com/a", "走數苦主帖一"), d("https://lihkg.com/b", "走數苦主帖二"), d("https://www.threads.net/c", "走數苦主帖三")]).riskBandZh).toBe("風險偏高");
  });
});

describe("praise gate", () => {
  it("dispute keywords in snippets block 未見負面摘要 (stay 中性)", () => {
    expect(band([], { boundDisputeHitCount: 3, boundPraiseHitCount: 2 }).riskBandZh).toBe("中性");
  });
});

describe("RISK_BAND_MAX serve-time cap", () => {
  afterEach(() => { delete process.env.RISK_BAND_MAX; });
  const report = (riskBandZh: RiskReport["evaluation"]["riskBandZh"], legalEvents: unknown[] = []) =>
    ({
      generatedAt: G,
      evaluation: { riskBandZh },
      official: { mwcMatched: false, legalEvents },
      signals: { boundHitCount: 3 },
    }) as unknown as RiskReport;
  it("unset / invalid → no cap", () => {
    expect(applyRiskBandMaxCapToReport(report("風險偏高")).evaluation.riskBandZh).toBe("風險偏高");
    process.env.RISK_BAND_MAX = "high";
    expect(applyRiskBandMaxCapToReport(report("風險偏高")).evaluation.riskBandZh).toBe("風險偏高");
  });
  it("中性 cap never pushes a judgment floor below 風險中等", () => {
    process.env.RISK_BAND_MAX = "中性";
    const ev = { eventDate: "2025-02-10", court: "x", caseNumbers: ["HCA 1/2025"], partyRole: "defendant", judgmentCategory: "small_claims_debt", outcomeHint: "defendant_liable", sourceUrl: "https://legalref.judiciary.hk/x" };
    expect(applyRiskBandMaxCapToReport(report("風險中等", [ev])).evaluation.riskBandZh).toBe("風險中等");
    expect(applyRiskBandMaxCapToReport(report("風險中等")).evaluation.riskBandZh).toBe("中性");
  });
});
