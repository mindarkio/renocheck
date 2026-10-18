import { afterEach, describe, expect, it, vi } from "vitest";

const { searchCrLocalByNameBeginsWith, searchCrLocalByBrnEqual } = vi.hoisted(
  () => ({
    searchCrLocalByNameBeginsWith: vi.fn(),
    searchCrLocalByBrnEqual: vi.fn(),
  }),
);

vi.mock("./cr-register/client", () => ({
  searchCrLocalByNameBeginsWith,
  searchCrLocalByBrnEqual,
}));

import { clearCrRegistryCacheForTests } from "./cr-register/memory-cache";
import { resetCrApiThrottleForTests } from "./cr-register/throttle";
import { resetCrCircuitBreakerForTests } from "./cr-register/circuit-breaker";
import type { CrApiLocalRow } from "./cr-register/types";
import { lookupCompaniesRegistryForSearch } from "./cr-registry-lookup";
import { companyNameOnlySearchInput } from "./normalize-search-input";
import {
  shouldShowMwcMissFallbackNote,
  shouldShowMwcMissWithCrFoundNote,
  shouldShowUnverifiedCompanyRegistrationAlert,
} from "./unverified-company-registration";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { RiskReport } from "./report-schema";
import { CR_ESERVICES_URL } from "./report-trust-copy-zh";

function row(en: string, brn = "C1566911"): CrApiLocalRow {
  return {
    Brn: brn,
    English_Company_Name: en,
    Chinese_Company_Name: "NULL",
    Company_Type: "Private company limited by shares",
    Date_of_Incorporation: "01-01-2020",
    Address_of_Registered_Office: "HK",
  };
}

afterEach(() => {
  vi.clearAllMocks();
  clearCrRegistryCacheForTests();
  resetCrApiThrottleForTests();
  resetCrCircuitBreakerForTests();
});

describe("lookupCompaniesRegistryForSearch", () => {
  it("SUN HUNG KAI prefix → tier B match (B1)", async () => {
    searchCrLocalByNameBeginsWith.mockResolvedValue({
      kind: "rows",
      rows: [row("SUN HUNG KAI & CO LIMITED")],
    });
    const official = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("SUN HUNG KAI & CO LIMITED"),
      "SUN HUNG KAI & CO LIMITED",
      null,
    );
    expect(official.lookupStatus).toBe("ok");
    expect(official.matched).toBe(true);
    expect(official.matchTier).toBe("B");
    expect(official.hints).not.toContain("not_found_in_active_list");
    expect(searchCrLocalByNameBeginsWith).toHaveBeenCalledWith(
      "SUN HUNG KAI",
      expect.anything(),
    );
  });

  it("all prefix attempts 400 → not_found", async () => {
    searchCrLocalByNameBeginsWith.mockResolvedValue({ kind: "no_result" });
    const official = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("合成測試有限公司"),
      "合成測試有限公司",
      null,
    );
    expect(official.hints).toContain("not_found_in_active_list");
  });

  it("Brn 400 + name hit → tier B, no not_found (M7)", async () => {
    searchCrLocalByBrnEqual.mockResolvedValue({ kind: "no_result" });
    searchCrLocalByNameBeginsWith.mockResolvedValue({
      kind: "rows",
      rows: [row("合成測試有限公司", "C9999999")],
    });
    const official = await lookupCompaniesRegistryForSearch(
      {
        companyName: "合成測試有限公司",
        br: "C1234567",
        matchType: "br",
      },
      "合成測試有限公司",
      null,
    );
    expect(official.matched).toBe(true);
    expect(official.matchTier).toBe("B");
    expect(official.hints).not.toContain("not_found_in_active_list");
  });

  it("Brn hit but name mismatch → inconclusive, no MWC note (M7)", async () => {
    searchCrLocalByBrnEqual.mockResolvedValue({
      kind: "rows",
      rows: [row("COMPLETELY DIFFERENT LIMITED")],
    });
    const official = await lookupCompaniesRegistryForSearch(
      {
        companyName: "合成測試有限公司",
        br: "C1234567",
        matchType: "br",
      },
      "合成測試有限公司",
      null,
    );
    expect(official.matched).toBe(false);
    const report = riskReportFromCr(official);
    expect(shouldShowMwcMissWithCrFoundNote(report)).toBe(false);
    expect(shouldShowUnverifiedCompanyRegistrationAlert(report)).toBe(false);
  });

  it("phone search → skipped", async () => {
    const official = await lookupCompaniesRegistryForSearch(
      { phone: "91234567", matchType: "phone" },
      "91234567",
      null,
    );
    expect(official.lookupStatus).toBe("skipped");
  });
});

function riskReportFromCr(
  cr: NonNullable<RiskReport["official"]["companiesRegistry"]>,
): RiskReport {
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
    official: { mwcMatched: false, companiesRegistry: cr },
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

describe("C.2c gating with lookup output", () => {
  it("ambiguous → fallback note, no alert (L7)", async () => {
    searchCrLocalByNameBeginsWith.mockResolvedValue({
      kind: "rows",
      rows: [
        row("AAA LIMITED", "C1111111"),
        row("AAA LIMITED", "C2222222"),
      ],
    });
    const official = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("AAA LIMITED"),
      "AAA LIMITED",
      null,
    );
    const report = riskReportFromCr(official);
    expect(shouldShowUnverifiedCompanyRegistrationAlert(report)).toBe(false);
    expect(shouldShowMwcMissFallbackNote(report)).toBe(true);
  });

  it("no companiesRegistry on report → no alert/note helpers", () => {
    const report = riskReportFromCr({
      lookupStatus: "ok",
      matched: false,
      hints: ["not_found_in_active_list"],
      retrievedAt: "2026-10-18T12:00:00.000Z",
      icrisHomeUrl: CR_ESERVICES_URL,
    });
    const withoutCr: RiskReport = {
      ...report,
      official: { mwcMatched: false },
    };
    expect(
      shouldShowUnverifiedCompanyRegistrationAlert(withoutCr),
    ).toBe(false);
    expect(shouldShowMwcMissWithCrFoundNote(withoutCr)).toBe(false);
    expect(shouldShowMwcMissFallbackNote(withoutCr)).toBe(false);
  });
});
