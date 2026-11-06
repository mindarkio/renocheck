import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import {
  crStatusChipLabel,
  offRegisterCrKind,
  offRegisterCrLeadZh,
  shouldEmphasizeCompaniesRegistry,
  shouldShowOffRegisterState,
} from "./off-register-report";
import { buildReportTocEntries } from "./report-section-toc";
import type { CompaniesRegistryOfficial, RiskReport } from "./report-schema";
import {
  CR_ESERVICES_URL,
  CR_STATUS_CHIP_CANDIDATES_ZH,
  CR_STATUS_CHIP_MATCHED_ZH,
  CR_STATUS_CHIP_NOT_FOUND_ZH,
  CR_STATUS_CHIP_UNAVAILABLE_ZH,
  MWC_MISS_FALLBACK_BODY_PARAGRAPHS_ZH,
  MWC_MISS_NOTE_CR_SIMILAR_ZH,
  OFF_REGISTER_CR_NOT_RUN_LEAD_ZH,
  OFF_REGISTER_CR_UNAVAILABLE_LEAD_ZH,
} from "./report-trust-copy-zh";

function cr(
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

function report(
  overrides: Partial<RiskReport> & {
    official?: Partial<RiskReport["official"]>;
    entity?: Partial<RiskReport["entity"]>;
  } = {},
): RiskReport {
  const { official, entity, ...rest } = overrides;
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: official?.mwcMatched ?? false,
    boundHitCount: 0,
    highlightCount: 0,
  });
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "合成品牌工作室",
      matchType: "company_name",
      queryEcho: "合成品牌工作室",
      searchLabelUsed: "合成品牌工作室",
      nameAlignment: "user_only",
      ...entity,
    },
    grade: "C",
    confidence: "medium",
    evaluation,
    summaryZh: "摘要",
    official: {
      mwcMatched: false,
      ...official,
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

describe("off-register report state", () => {
  it("shows for a company name with no MWC row, including ambiguous alignment", () => {
    expect(shouldShowOffRegisterState(report())).toBe(true);
    expect(
      shouldShowOffRegisterState(
        report({ entity: { nameAlignment: "ambiguous" } as RiskReport["entity"] }),
      ),
    ).toBe(true);
  });

  it("stays off when an MWC row is attached or the search is not a company name", () => {
    expect(
      shouldShowOffRegisterState(report({ official: { mwcMatched: true } })),
    ).toBe(false);
    expect(
      shouldShowOffRegisterState(
        report({
          entity: {
            displayName: "91234567",
            matchType: "phone",
            queryEcho: "91234567",
            searchLabelUsed: "91234567",
            nameAlignment: "user_only",
          },
        }),
      ),
    ).toBe(false);
  });

  it("treats CR error and timeout as unavailable, not as not-found", () => {
    const errored = report({
      official: { mwcMatched: false, companiesRegistry: cr({ lookupStatus: "error" }) },
    });
    expect(offRegisterCrKind(errored)).toBe("unavailable");
    expect(offRegisterCrLeadZh(errored)).toBe(OFF_REGISTER_CR_UNAVAILABLE_LEAD_ZH);
    expect(offRegisterCrLeadZh(errored)).not.toContain("找不到");
    expect(crStatusChipLabel(errored)).toBe(CR_STATUS_CHIP_UNAVAILABLE_ZH);
    expect(MWC_MISS_FALLBACK_BODY_PARAGRAPHS_ZH[1]).toContain("冇對照公司註冊處");
    expect(offRegisterCrLeadZh(errored)).not.toContain("冇對照公司註冊處");
  });

  it("names CR candidates and a tier C similar match without calling them verified", () => {
    const candidates = report({
      official: {
        mwcMatched: false,
        companiesRegistry: cr({
          matched: false,
          candidateNames: [{ nameZh: "其他工程有限公司", brNo: "C9000001" }],
        }),
      },
    });
    expect(offRegisterCrKind(candidates)).toBe("candidates");
    expect(crStatusChipLabel(candidates)).toBe(CR_STATUS_CHIP_CANDIDATES_ZH);
    expect(shouldEmphasizeCompaniesRegistry(candidates)).toBe(true);

    const similar = report({
      official: {
        mwcMatched: false,
        companiesRegistry: cr({ matched: true, matchTier: "C" }),
      },
    });
    expect(offRegisterCrLeadZh(similar)).toBe(MWC_MISS_NOTE_CR_SIMILAR_ZH);
    expect(crStatusChipLabel(similar)).toBe(CR_STATUS_CHIP_MATCHED_ZH);
  });

  it("does not invent a CR result when the lookup did not run", () => {
    const missing = report();
    expect(offRegisterCrKind(missing)).toBe("not_run");
    expect(offRegisterCrLeadZh(missing)).toBe(OFF_REGISTER_CR_NOT_RUN_LEAD_ZH);
    expect(crStatusChipLabel(missing)).toBeNull();
  });

  it("keeps the not-found chip for an active-list miss", () => {
    const missed = report({
      official: {
        mwcMatched: false,
        companiesRegistry: cr({
          matched: false,
          hints: ["not_found_in_active_list"],
        }),
      },
    });
    expect(crStatusChipLabel(missed)).toBe(CR_STATUS_CHIP_NOT_FOUND_ZH);
  });

  it("puts the off-register heading in the toc and drops the legacy miss notes", () => {
    const ids = buildReportTocEntries(
      report({
        official: {
          mwcMatched: false,
          companiesRegistry: cr({
            matched: false,
            hints: ["not_found_in_active_list"],
          }),
        },
      }),
    ).map((entry) => entry.id);
    expect(ids).toContain("off-register-heading");
    expect(ids).not.toContain("unverified-registration-heading");
    expect(ids).not.toContain("mwc-miss-note-heading");
    expect(ids).not.toContain("mwc-miss-fallback-heading");
  });
});
