import { describe, expect, it } from "vitest";
import { calibrateEvaluation } from "./risk-report-calibration-v2";
import {
  dedupeDisputeHighlights,
  isDisputeHighlight,
  ratedDisputeHighlights,
  snippetHasDisputeKeyword,
} from "./dispute-signals";
import { countBoundDisputeSignals } from "./search-evidence-filter";
import type { WebSearchHit } from "./web-search";

describe("snippetHasDisputeKeyword", () => {
  it("negates 冇糾紛 and 零投訴", () => {
    expect(snippetHasDisputeKeyword("完全冇糾紛，推薦")).toBe(false);
    expect(snippetHasDisputeKeyword("服務好好，零投訴")).toBe(false);
  });

  it("counts plain 投訴 without negation", () => {
    expect(snippetHasDisputeKeyword("多宗投訴")).toBe(true);
  });

  it("NFKC normalises before match (Kangxi 走 + 數)", () => {
    expect(snippetHasDisputeKeyword("⾛數")).toBe(true);
  });

  it("O5: 延誤 counts for display snippet only, not grading", () => {
    const hits: WebSearchHit[] = [
      {
        title: "帖",
        url: "https://www.lihkg.com/1",
        snippet: "冇走數但延誤半年",
      },
    ];
    expect(countBoundDisputeSignals(hits)).toBe(1);
    const out = calibrateEvaluation({
      slice: {
        grade: "C",
        confidence: "low",
        summaryZh: "x",
        discussionCount: 0,
        themes: [],
        highlights: [],
      },
      evidence: {
        llmHitCount: 1,
        boundHitCount: 1,
        serpHitCount: 5,
        boundDisputeHitCount: countBoundDisputeSignals(hits),
        boundPraiseHitCount: 0,
      },
      mwcMatched: false,
      mwcAmbiguous: false,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.evaluation.riskBandZh).not.toBe("風險偏高");
    expect(out.evaluation.riskBandZh).not.toBe("風險中等");
  });
});

describe("syndication dedupe", () => {
  const title = "裝修公司被揭工程延誤";
  const h = (url: string) => ({
    summaryZh: title,
    url,
    incidentType: "payment_dispute" as const,
    approxYear: "2025",
  });

  it("counts one story across hket, mingpao, yahoo", () => {
    const highlights = [
      h("https://www.hket.com/a"),
      h("https://www.mingpao.com/b"),
      h("https://hk.yahoo.com/c"),
    ];
    expect(dedupeDisputeHighlights(highlights)).toHaveLength(1);
    expect(ratedDisputeHighlights(highlights, "2026-06-01T00:00:00.000Z")).toHaveLength(
      1,
    );
  });
});

describe("isDisputeHighlight", () => {
  it("communication and other are not disputes", () => {
    expect(
      isDisputeHighlight({
        summaryZh: "溝通順暢",
        url: "https://www.facebook.com/x",
        incidentType: "communication",
      }),
    ).toBe(false);
    expect(
      isDisputeHighlight({
        summaryZh: "爛尾投訴",
        url: "https://www.lihkg.com/x",
        incidentType: "other",
      }),
    ).toBe(false);
  });
});
