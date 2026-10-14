import { describe, expect, it } from "vitest";
import { calibrateLlmRiskSlice, capGradeToMax } from "./risk-report-calibration";

const base = {
  grade: "D" as const,
  confidence: "medium" as const,
  summaryZh: "摘要",
  themes: ["爛尾"],
  highlights: [
    {
      url: "https://example.com/a",
      summaryZh: "事件",
      sourceName: "來源",
      dateHint: "日期不詳",
    },
  ],
};

describe("capGradeToMax", () => {
  it("caps D to C", () => {
    expect(capGradeToMax("D", "C")).toBe("C");
  });
  it("does not upgrade F to C", () => {
    expect(capGradeToMax("F", "C")).toBe("C");
  });
});

describe("calibrateLlmRiskSlice", () => {
  it("caps discussionCount to highlights length", () => {
    const out = calibrateLlmRiskSlice(
      { ...base, discussionCount: 5 },
      { llmHitCount: 8, boundHitCount: 8, serpHitCount: 20 },
    );
    expect(out.discussionCount).toBe(1);
  });

  it("downgrades confidence when llm hits <= 2", () => {
    const out = calibrateLlmRiskSlice(
      { ...base, discussionCount: 1 },
      { llmHitCount: 1, boundHitCount: 1, serpHitCount: 10 },
    );
    expect(out.confidence).toBe("low");
  });

  it("drops 未檢出相關討論 theme when highlights exist", () => {
    const out = calibrateLlmRiskSlice(
      {
        ...base,
        discussionCount: 1,
        themes: ["溝通", "未檢出相關討論"],
      },
      { llmHitCount: 1, boundHitCount: 1, serpHitCount: 5 },
    );
    expect(out.themes).toEqual(["溝通"]);
  });

  it("drops 未檢出 when bound>0 but no highlights (P2-A2)", () => {
    const out = calibrateLlmRiskSlice(
      {
        grade: "D",
        confidence: "medium",
        summaryZh: "x",
        discussionCount: 0,
        themes: ["未檢出相關討論"],
        highlights: [],
      },
      { llmHitCount: 1, boundHitCount: 1, serpHitCount: 26 },
    );
    expect(out.themes).not.toContain("未檢出相關討論");
    expect(out.grade).toBe("C");
  });

  it("caps fictional-style zero highlights to C (including LLM A)", () => {
    const out = calibrateLlmRiskSlice(
      {
        grade: "A",
        confidence: "low",
        summaryZh: "測試",
        discussionCount: 0,
        themes: ["未檢出相關討論"],
        highlights: [],
      },
      { llmHitCount: 0, boundHitCount: 0, serpHitCount: 25 },
    );
    expect(out.grade).toBe("C");
  });

  it("allows D with two highlights and dispute theme", () => {
    const h = base.highlights[0];
    const out = calibrateLlmRiskSlice(
      {
        grade: "D",
        confidence: "low",
        summaryZh: "測試",
        discussionCount: 2,
        themes: ["爛尾", "超支"],
        highlights: [h, { ...h, url: "https://example.com/b" }],
      },
      { llmHitCount: 5, boundHitCount: 5, serpHitCount: 20 },
    );
    expect(out.grade).toBe("D");
  });

  it("caps single highlight to C even if LLM said D", () => {
    const out = calibrateLlmRiskSlice(
      {
        ...base,
        grade: "D",
        discussionCount: 1,
        themes: ["爛尾"],
      },
      { llmHitCount: 3, boundHitCount: 3, serpHitCount: 10 },
    );
    expect(out.grade).toBe("C");
  });

  it("keeps medium when many hits and multiple highlights", () => {
    const out = calibrateLlmRiskSlice(
      {
        ...base,
        discussionCount: 3,
        highlights: [
          base.highlights[0],
          { ...base.highlights[0], url: "https://example.com/b" },
          { ...base.highlights[0], url: "https://example.com/c" },
        ],
      },
      { llmHitCount: 8, boundHitCount: 8, serpHitCount: 20 },
    );
    expect(out.confidence).toBe("medium");
    expect(out.discussionCount).toBe(3);
  });

  it("replaces overconfident zero-evidence summary", () => {
    const out = calibrateLlmRiskSlice(
      {
        grade: "C",
        confidence: "low",
        summaryZh: "根據公開資料，暫無具體風險紀錄。",
        discussionCount: 0,
        themes: ["未檢出相關討論"],
        highlights: [],
      },
      { llmHitCount: 0, boundHitCount: 0, serpHitCount: 15 },
    );
    expect(out.summaryZh).toContain("資料有限");
    expect(out.summaryZh).not.toContain("風險紀錄");
  });

  it("adjusts summary when bound hits but no highlights", () => {
    const out = calibrateLlmRiskSlice(
      {
        grade: "C",
        confidence: "medium",
        summaryZh: "舊摘要",
        discussionCount: 0,
        themes: [],
        highlights: [],
      },
      { llmHitCount: 2, boundHitCount: 2, serpHitCount: 20 },
    );
    expect(out.summaryZh).toContain("未能形成可引用");
    expect(out.confidence).toBe("low");
  });
});
