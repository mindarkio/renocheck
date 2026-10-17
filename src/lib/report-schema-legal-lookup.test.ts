import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import { riskReportSchema } from "./report-schema";

const evaluationC = buildEvaluationStub({
  overallGrade: "C",
  confidence: "low",
  mwcMatched: false,
  boundHitCount: 0,
  highlightCount: 0,
});

const baseReport = {
  reportVersion: REPORT_VERSION,
  entity: {
    displayName: "示例裝修有限公司",
    matchType: "company_name" as const,
    queryEcho: "示例裝修有限公司",
    searchLabelUsed: "示例裝修有限公司",
    nameAlignment: "user_only" as const,
  },
  grade: "C" as const,
  confidence: "low" as const,
  evaluation: evaluationC,
  summaryZh: "公開資料有限，未能形成較強信號，建議自行核實牌照與合約。",
  official: { mwcMatched: false },
  signals: {
    discussionCount: 0,
    themes: [],
    retrievalEvidence: [],
    actionableClauses: [],
    contractChecklist: ["測試提問？"],
  },
  disclaimerVersion: "1.0.0",
  generatedAt: "2026-10-17T12:00:00.000Z",
};

describe("riskReportSchema legalLookupStatus", () => {
  it("accepts official.legalLookupStatus ok | error | timeout", () => {
    for (const status of ["ok", "error", "timeout"] as const) {
      const parsed = riskReportSchema.safeParse({
        ...baseReport,
        official: { mwcMatched: false, legalLookupStatus: status },
      });
      expect(parsed.success).toBe(true);
    }
  });
});
