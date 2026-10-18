import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { RiskReport } from "./report-schema";
import { shouldShowNonLimitedContractorNotice } from "./non-limited-contractor-notice";
import {
  NON_LIMITED_CONTRACTOR_NOTICE_ZH,
  REPORT_TRUST_FORBIDDEN_ZH,
  REPORT_TRUST_NEGATED_ALLOWLIST_ZH,
} from "./report-trust-copy-zh";

function assertClean(text: string): void {
  let t = text;
  for (const ok of REPORT_TRUST_NEGATED_ALLOWLIST_ZH) {
    t = t.split(ok).join("");
  }
  for (const w of REPORT_TRUST_FORBIDDEN_ZH) {
    expect(t).not.toContain(w);
  }
}

function reportWithLabel(
  searchLabelUsed: string,
  official?: RiskReport["official"],
): RiskReport {
  const mwcMatched = official?.mwcMatched ?? false;
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched,
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
    official: { mwcMatched: false, ...official },
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
      shouldShowNonLimitedContractorNotice(reportWithLabel("合成裝修工程")),
    ).toBe(true);
  });

  it("shows for SYNTH DECOR style name", () => {
    expect(
      shouldShowNonLimitedContractorNotice(reportWithLabel("SYNTH DECOR")),
    ).toBe(true);
  });

  it("hides for limited company label", () => {
    expect(
      shouldShowNonLimitedContractorNotice(
        reportWithLabel("合成測試有限公司"),
      ),
    ).toBe(false);
  });

  it("hides for phone-only label", () => {
    expect(
      shouldShowNonLimitedContractorNotice(reportWithLabel("91234567")),
    ).toBe(false);
  });

  it("hides for BR-only label", () => {
    expect(
      shouldShowNonLimitedContractorNotice(reportWithLabel("12345678")),
    ).toBe(false);
  });

  it("uses official company name when MWC matched", () => {
    expect(
      shouldShowNonLimitedContractorNotice(
        reportWithLabel("合成測試有限公司", {
          mwcMatched: true,
          details: { companyName: "合成工程" },
        }),
      ),
    ).toBe(true);
  });

  it("notice copy avoids forbidden terms", () => {
    assertClean(NON_LIMITED_CONTRACTOR_NOTICE_ZH);
  });
});
