import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { RiskReport } from "./report-schema";
import { shouldShowUnverifiedCompanyRegistrationMode } from "./unverified-company-registration";
import {
  collectReportTrustCopyStrings,
  REPORT_TRUST_FORBIDDEN_ZH,
} from "./report-trust-copy-zh";

function baseReport(
  official: RiskReport["official"],
): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: official.mwcMatched,
    boundHitCount: 0,
    highlightCount: 0,
  });
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "合成測試有限公司",
      matchType: "company_name",
      queryEcho: "合成測試有限公司",
      searchLabelUsed: "合成測試有限公司",
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "medium",
    evaluation,
    summaryZh: "摘要",
    official,
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      contractChecklist: ["佔位"],
      actionableClauses: [],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-18T12:00:00.000Z",
  };
}

describe("shouldShowUnverifiedCompanyRegistrationMode", () => {
  it("triggers when MWC miss and no legal events", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationMode(
        baseReport({ mwcMatched: false, legalLookupStatus: "ok" }),
      ),
    ).toBe(true);
  });

  it("does not trigger when MWC matched", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationMode(
        baseReport({ mwcMatched: true }),
      ),
    ).toBe(false);
  });

  it("does not trigger when legal lookup degraded", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationMode(
        baseReport({ mwcMatched: false, legalLookupStatus: "timeout" }),
      ),
    ).toBe(false);
  });

  it("does not trigger when legal events present", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationMode(
        baseReport({
          mwcMatched: false,
          legalEvents: [
            {
              sourceType: "court_judgment",
              caseRef: "SYNTH/1/2024",
              court: "高院",
              eventDate: "2024-01-01",
              partyRole: "defendant",
              judgmentCategory: "other_civil",
              sourceUrl: "https://example.com/j",
              matchReasonZh: "合成",
              hearingKeyPointsZh: ["合成事實"],
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("C.2c copy avoids forbidden terms", () => {
    const blob = collectReportTrustCopyStrings().join("\n");
    for (const term of REPORT_TRUST_FORBIDDEN_ZH) {
      expect(blob).not.toContain(term);
    }
  });
});
