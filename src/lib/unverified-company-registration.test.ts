import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { CR_ESERVICES_URL } from "./report-trust-copy-zh";
import { buildEvaluationStub } from "./evaluation-stub";
import type { CompaniesRegistryOfficial, RiskReport } from "./report-schema";
import {
  shouldShowMwcMissFallbackNote,
  shouldShowMwcMissWithCrFoundNote,
  shouldShowUnverifiedCompanyRegistrationAlert,
} from "./unverified-company-registration";

function crBase(
  overrides: Partial<CompaniesRegistryOfficial> = {},
): CompaniesRegistryOfficial {
  return {
    lookupStatus: "ok",
    retrievedAt: "2026-10-18T12:00:00.000Z",
    hints: [],
    icrisHomeUrl: CR_ESERVICES_URL,
    ...overrides,
  };
}

function baseReport(
  overrides: Partial<RiskReport> & {
    official?: Partial<RiskReport["official"]>;
    entity?: Partial<RiskReport["entity"]>;
  } = {},
): RiskReport {
  const { official: officialOverride, entity: entityOverride, ...rest } =
    overrides;
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: officialOverride?.mwcMatched ?? false,
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
      ...entityOverride,
    },
    grade: "C",
    confidence: "medium",
    evaluation,
    summaryZh: "摘要",
    official: {
      mwcMatched: false,
      companiesRegistry: crBase({
        hints: ["not_found_in_active_list"],
        matched: false,
      }),
      ...officialOverride,
    },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      contractChecklist: ["佔位"],
      actionableClauses: [],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-18T12:00:00.000Z",
    ...rest,
  };
}

describe("C.2c alert (CR not_found)", () => {
  it("triggers when CR not_found and MWC miss", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationAlert(
        baseReport({ official: { mwcMatched: false, legalLookupStatus: "ok" } }),
      ),
    ).toBe(true);
  });

  it("does not trigger without not_found hint", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationAlert(
        baseReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crBase({ matched: false, hints: [] }),
          },
        }),
      ),
    ).toBe(false);
  });

  it("does not trigger when CR matched", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationAlert(
        baseReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crBase({ matched: true }),
          },
        }),
      ),
    ).toBe(false);
  });

  it("does not trigger when CR ambiguous", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationAlert(
        baseReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crBase({
              matched: false,
              matchAmbiguous: true,
            }),
          },
        }),
      ),
    ).toBe(false);
  });

  it("does not trigger when CR degraded", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationAlert(
        baseReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crBase({ lookupStatus: "timeout" }),
          },
        }),
      ),
    ).toBe(false);
  });

  it("does not trigger when legal lookup degraded", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationAlert(
        baseReport({
          official: { mwcMatched: false, legalLookupStatus: "error" },
        }),
      ),
    ).toBe(false);
  });

  it("does not trigger for non-corporate name (B2)", () => {
    expect(
      shouldShowUnverifiedCompanyRegistrationAlert(
        baseReport({
          entity: {
            displayName: "合成裝修工程",
            matchType: "company_name",
            queryEcho: "合成裝修工程",
            searchLabelUsed: "合成裝修工程",
            nameAlignment: "user_only",
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("MWC miss note (CR matched)", () => {
  it("shows note when CR matched and MWC miss", () => {
    expect(
      shouldShowMwcMissWithCrFoundNote(
        baseReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crBase({ matched: true }),
          },
        }),
      ),
    ).toBe(true);
  });

  it("does not show note when CR not_found", () => {
    expect(
      shouldShowMwcMissWithCrFoundNote(
        baseReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crBase({
              matched: false,
              hints: ["not_found_in_active_list"],
            }),
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("MWC miss fallback note (L7)", () => {
  it("shows when CR ambiguous and MWC miss", () => {
    expect(
      shouldShowMwcMissFallbackNote(
        baseReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crBase({
              matched: false,
              matchAmbiguous: true,
            }),
          },
        }),
      ),
    ).toBe(true);
  });

  it("does not show when alert would show", () => {
    expect(
      shouldShowMwcMissFallbackNote(
        baseReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crBase({
              matched: false,
              hints: ["not_found_in_active_list"],
            }),
          },
        }),
      ),
    ).toBe(false);
  });
});
