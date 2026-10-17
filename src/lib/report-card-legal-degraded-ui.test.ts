import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { RiskReport } from "./report-schema";
import { reportCardShowFooterNotes } from "./report-card-legal-degraded-ui";

function degradedReport(): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: false,
    boundHitCount: 0,
    highlightCount: 1,
  });
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "測試公司",
      matchType: "company_name",
      queryEcho: "測試公司",
      searchLabelUsed: "測試公司",
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "medium",
    evaluation: {
      ...evaluation,
      riskBandZh: "未見負面摘要",
    },
    summaryZh: "摘要",
    official: { mwcMatched: false, legalLookupStatus: "timeout" },
    signals: {
      discussionCount: 1,
      themes: [],
      retrievalEvidence: [],
      actionableClauses: [],
      contractChecklist: ["有無書面合約？"],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-17T12:00:00.000Z",
  };
}

describe("reportCardShowFooterNotes", () => {
  it("keeps medium-confidence footer when legal lookup degraded", () => {
    expect(reportCardShowFooterNotes(degradedReport(), 1)).toBe(true);
  });
});
