import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { RiskReport } from "./report-schema";
import { shouldShowUnverifiedCompanyRegistrationMode } from "./unverified-company-registration";

function baseReport(
  overrides: Partial<RiskReport> & {
    official?: RiskReport["official"];
    entity?: Partial<RiskReport["entity"]>;
  } = {},
): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: overrides.official?.mwcMatched ?? false,
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
      ...overrides.entity,
    },
    grade: "C",
    confidence: "medium",
    evaluation,
    summaryZh: "摘要",
    official: { mwcMatched: false, ...overrides.official },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      contractChecklist: ["佔位"],
      actionableClauses: [],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-18T12:00:00.000Z",
    ...overrides,
  };
}

describe("shouldShowUnverifiedCompanyRegistrationMode", () => {
  it("triggers when MWC miss and legal ok", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationMode(
        baseReport({ official: { mwcMatched: false, legalLookupStatus: "ok" } }),
      ),
    ).toBe(true);
  });

  it("triggers when legalLookupStatus undefined", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationMode(
        baseReport({ official: { mwcMatched: false } }),
      ),
    ).toBe(true);
  });

  it("does not trigger when MWC matched", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationMode(
        baseReport({ official: { mwcMatched: true } }),
      ),
    ).toBe(false);
  });

  it("does not trigger when legal lookup degraded", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationMode(
        baseReport({
          official: { mwcMatched: false, legalLookupStatus: "error" },
        }),
      ),
    ).toBe(false);
  });

  it("does not trigger for pure BR search label", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationMode(
        baseReport({
          entity: {
            matchType: "br",
            searchLabelUsed: "12345678",
            queryEcho: "12345678",
            displayName: "12345678",
            nameAlignment: "user_only",
          },
        }),
      ),
    ).toBe(false);
  });

  it("triggers for phone search with no MWC match", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationMode(
        baseReport({
          entity: {
            matchType: "phone",
            searchLabelUsed: "91234567",
            queryEcho: "91234567",
            displayName: "91234567",
            normalizedPhone: "91234567",
            nameAlignment: "user_only",
          },
        }),
      ),
    ).toBe(true);
  });
});
