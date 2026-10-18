import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { RiskReport } from "./report-schema";
import { shouldShowNonLimitedContractorNotice } from "./non-limited-contractor-notice";
import { REPORT_TRUST_FORBIDDEN_ZH } from "./report-trust-copy-zh";
import {
  NON_LIMITED_CAUSE_LIST_SCOPE_ZH,
  NON_LIMITED_CONTRACTOR_NOTICE_ZH,
} from "./report-trust-copy-zh";

function reportWithLabel(searchLabelUsed: string): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: false,
    boundHitCount: 0,
    highlightCount: 0,
  });
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: searchLabelUsed,
      matchType: "company_name",
      queryEcho: searchLabelUsed,
      searchLabelUsed,
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "medium",
    evaluation,
    summaryZh: "摘要",
    official: { mwcMatched: false },
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

describe("shouldShowNonLimitedContractorNotice", () => {
  it("shows for non-corporate search label", () => {
    expect(
      shouldShowNonLimitedContractorNotice(
        reportWithLabel("合成裝修工程"),
      ),
    ).toBe(true);
  });

  it("hides for limited company label", () => {
    expect(
      shouldShowNonLimitedContractorNotice(
        reportWithLabel("合成測試有限公司"),
      ),
    ).toBe(false);
  });

  it("notice copy avoids forbidden terms", () => {
    const blob = `${NON_LIMITED_CONTRACTOR_NOTICE_ZH}\n${NON_LIMITED_CAUSE_LIST_SCOPE_ZH}`;
    for (const term of REPORT_TRUST_FORBIDDEN_ZH) {
      expect(blob).not.toContain(term);
    }
  });
});
