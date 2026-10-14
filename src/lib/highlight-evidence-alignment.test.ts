import { describe, expect, it } from "vitest";
import { enforceHighlightEvidenceAlignment } from "./highlight-evidence-alignment";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";

function minimalReport(
  highlights: { summaryZh: string; url: string }[],
) {
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "測試",
      matchType: "company_name" as const,
      queryEcho: "測試",
      searchLabelUsed: "測試",
      nameAlignment: "user_only" as const,
    },
    grade: "C" as const,
    confidence: "medium" as const,
    evaluation: buildEvaluationStub({
      overallGrade: "C",
      confidence: "medium",
      mwcMatched: false,
      boundHitCount: 1,
      highlightCount: highlights.length,
    }),
    summaryZh: "摘要",
    official: { mwcMatched: false },
    signals: {
      discussionCount: highlights.length,
      themes: [],
      highlights,
      retrievalEvidence: [],
      actionableClauses: [],
      contractChecklist: ["提問？"],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
  };
}

describe("enforceHighlightEvidenceAlignment", () => {
  it("drops highlights with URLs not in allowed set", () => {
    const report = minimalReport([
      {
        summaryZh: "事件",
        url: "https://www.lihkg.com/thread/1",
      },
      {
        summaryZh: "幻覺",
        url: "https://evil.example/fake",
      },
    ]);
    const out = enforceHighlightEvidenceAlignment(
      report,
      new Set(["https://www.lihkg.com/thread/1"]),
    );
    expect(out.signals.highlights).toHaveLength(1);
    expect(out.confidence).toBe("low");
    expect(out.signals.discussionCount).toBe(1);
  });
});
