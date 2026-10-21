import { describe, expect, it } from "vitest";
import {
  dedupeDisputeHighlights,
  isDisputeHighlight,
  ratedDisputeHighlights,
  snippetHasDisputeKeyword,
} from "./dispute-signals";

describe("snippetHasDisputeKeyword", () => {
  it("negates 冇糾紛 and 零投訴", () => {
    expect(snippetHasDisputeKeyword("完全冇糾紛，推薦")).toBe(false);
    expect(snippetHasDisputeKeyword("服務好好，零投訴")).toBe(false);
  });

  it("counts plain 投訴 without negation", () => {
    expect(snippetHasDisputeKeyword("多宗投訴")).toBe(true);
  });

  it("NFKC normalises before match", () => {
    expect(snippetHasDisputeKeyword("爭議")).toBe(true);
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
