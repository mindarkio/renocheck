import { describe, expect, it } from "vitest";
import {
  autoImportEligibility,
  defendantHasEngineeringKeyword,
  hasRenovationEngineeringSignal,
} from "./judgment-d2-case-policy";

describe("judgment-d2-case-policy v3b", () => {
  it("requires renovation/engineering signal for DCCJ", () => {
    const r = autoImportEligibility({
      caseRef: "DCCJ 100/2020",
      partiesLine: "業主立案法團 對 中俊投資有限公司",
      profileId: "dccj-tier-a",
      renovationRelevantSuggested: true,
      defendantLabel: "中俊投資有限公司",
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) {
      expect(r.reason).toBe("weak_renovation_engineering_signal");
    }
  });

  it("keeps DCCJ when defendant name has engineering keyword", () => {
    const r = autoImportEligibility({
      caseRef: "DCCJ 100/2020",
      partiesLine: "業主 對 名富工程服務有限公司",
      profileId: "dccj-裝修",
      renovationRelevantSuggested: false,
      defendantLabel: "名富工程服務有限公司",
    });
    expect(r.eligible).toBe(true);
  });

  it("defendant engineering keyword helper", () => {
    expect(defendantHasEngineeringKeyword("PACIFICPLAN INTERIORS LTD")).toBe(
      true,
    );
    expect(defendantHasEngineeringKeyword("車之城有限公司")).toBe(false);
  });

  it("LDBM requires engineering keyword in defendant name", () => {
    const r = autoImportEligibility({
      caseRef: "LDBM 18/2012",
      partiesLine: "港深聯合物業管理有限公司 對 新昌管理服務有限公司",
      profileId: "ldbm-裝修",
      renovationRelevantSuggested: true,
      defendantLabel: "新昌管理服務有限公司",
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) {
      expect(r.reason).toBe("ldbm_defendant_name_no_engineering");
    }
  });

  it("LDPD still allows contract/debt profile signal", () => {
    const r = autoImportEligibility({
      caseRef: "LDPD 10/2020",
      partiesLine: "甲 對 乙有限公司",
      profileId: "ldpd-裝修",
      renovationRelevantSuggested: true,
      defendantLabel: "乙有限公司",
    });
    expect(r.eligible).toBe(true);
  });

  it("hasRenovationEngineeringSignal from parties", () => {
    expect(
      hasRenovationEngineeringSignal({
        partiesLine: "業主 對 某某裝修有限公司",
        defendantLabel: "某某有限公司",
      }),
    ).toBe(true);
  });
});
