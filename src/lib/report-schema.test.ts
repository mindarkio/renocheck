import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import { riskReportSchema, searchInputSchema } from "./report-schema";

const evaluationC = buildEvaluationStub({
  overallGrade: "C",
  confidence: "low",
  mwcMatched: false,
  boundHitCount: 0,
  highlightCount: 0,
});

const validReport = {
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
  generatedAt: new Date().toISOString(),
};

describe("riskReportSchema", () => {
  it("accepts a minimal valid report", () => {
    const result = riskReportSchema.safeParse(validReport);
    expect(result.success).toBe(true);
  });

  it("rejects summary over 120 chars", () => {
    const result = riskReportSchema.safeParse({
      ...validReport,
      summaryZh: "x".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it("rejects grade drift from evaluation.overallGrade", () => {
    const result = riskReportSchema.safeParse({
      ...validReport,
      grade: "B",
    });
    expect(result.success).toBe(false);
  });
});

describe("searchInputSchema", () => {
  it("requires at least one field", () => {
    expect(searchInputSchema.safeParse({}).success).toBe(false);
    expect(searchInputSchema.safeParse({ phone: "91234567" }).success).toBe(
      true,
    );
  });
});
