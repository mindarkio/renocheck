import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import { applyLegalEventFloors } from "./legal-event-calibration";
import type { OfficialLegalEvent } from "./legal-event-schema";
import type { RiskReport } from "./report-schema";

/** P5 golden: zero bound + defendant renovation civil → 風險中等 (DEC-0012 / DEC-0010 exception). */
describe("legal report golden", () => {
  it("zero-bound renovation defendant floors risk band", () => {
    const evaluation = buildEvaluationStub({
      overallGrade: "C",
      confidence: "low",
      mwcMatched: false,
      boundHitCount: 0,
      highlightCount: 0,
    });
    const report: RiskReport = {
      reportVersion: REPORT_VERSION,
      entity: {
        displayName: "示例裝修工程有限公司",
        matchType: "company_name",
        queryEcho: "示例裝修工程有限公司",
        searchLabelUsed: "示例裝修工程有限公司",
        nameAlignment: "user_only",
      },
      grade: "C",
      confidence: "low",
      evaluation: { ...evaluation, riskBandZh: "中性" },
      summaryZh: "測試",
      official: { mwcMatched: false },
      signals: {
        discussionCount: 0,
        themes: [],
        retrievalEvidence: [],
        contractChecklist: ["測試？"],
        actionableClauses: [],
        boundHitCount: 0,
      },
      disclaimerVersion: "1.0.0",
      generatedAt: "2026-01-15T12:00:00.000Z",
    };

    const event: OfficialLegalEvent = {
      sourceType: "court_judgment",
      caseRef: "DCCJ 9001/2020",
      court: "District Court",
      eventDate: "2021-03-15",
      judgmentCategory: "renovation_engineering_civil",
      partyRole: "defendant",
      outcomeHint: "defendant_liable",
      procedureStage: "final_judgment",
      hearingKeyPointsZh: ["合成 golden"],
      sourceUrl: "https://example.com/j",
      matchReasonZh: "公司名稱與匯入紀錄一致",
    };

    const out = applyLegalEventFloors(report, [event], 0);
    expect(out.evaluation.riskBandZh).toBe("風險中等");
    expect(out.evaluation.reputationTrack.disputeLevel).toBe(
      "active_concerning",
    );
  });
});
