import { describe, expect, it } from "vitest";
import { bindLlmSliceToWebHits, llmSliceSchema } from "./llm-risk-slice";

describe("llmSliceSchema", () => {
  it("parses extended slice with customClauses", () => {
    const parsed = llmSliceSchema.safeParse({
      grade: "C",
      confidence: "low",
      summaryZh: "根據本次可檢索的公開來源，未檢出與查詢對象相關的裝修糾紛討論摘要。",
      discussionCount: 0,
      themes: ["未檢出相關討論"],
      highlights: [],
      customClauses: [
        {
          category: "付款",
          clauseText: "付款期數是否與工程進度掛鈎？",
          reason: "公開討論曾提及超支爭議",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("defaults customClauses to empty", () => {
    const parsed = llmSliceSchema.parse({
      grade: "C",
      confidence: "low",
      summaryZh: "摘要",
      discussionCount: 0,
      themes: [],
      highlights: [],
    });
    expect(parsed.customClauses).toEqual([]);
  });
});

describe("bindLlmSliceToWebHits", () => {
  const webHits = [
    {
      title: "討論",
      url: "https://www.lihkg.com/thread/1",
      snippet: "摘要",
    },
  ];

  it("removes highlights with URLs not in webHits", () => {
    const bound = bindLlmSliceToWebHits(
      {
        grade: "C",
        confidence: "medium",
        summaryZh: "摘要",
        discussionCount: 2,
        themes: ["超支"],
        highlights: [
          {
            summaryZh: "事件一",
            url: "https://www.lihkg.com/thread/1",
          },
          {
            summaryZh: "幻覺",
            url: "https://evil.example/fake",
          },
        ],
        customClauses: [],
      },
      webHits,
    );
    expect(bound.highlightsDropped).toBe(1);
    expect(bound.calibrationInput.highlights).toHaveLength(1);
    expect(bound.calibrationInput.discussionCount).toBe(1);
  });

  it("passes through actionableClauses", () => {
    const clauses = [
      {
        category: "保養",
        clauseText: "保養期是否寫明？",
        reason: "資料有限",
      },
    ];
    const bound = bindLlmSliceToWebHits(
      {
        grade: "C",
        confidence: "low",
        summaryZh: "摘要",
        discussionCount: 0,
        themes: [],
        highlights: [],
        customClauses: clauses,
      },
      webHits,
    );
    expect(bound.actionableClauses).toEqual(clauses);
  });
});
