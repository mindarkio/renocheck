import { describe, expect, it } from "vitest";
import { runD2Gates } from "./judgment-d2-gates";
import type { JudgmentCandidateRow } from "./judgment-candidates-schema";

const baseRow = (
  partiesLine: string,
  caseRef = "DCCJ 57/2024",
): JudgmentCandidateRow => ({
  caseRef,
  eventDate: "2025-01-15",
  partiesLine,
  database: "Judgments",
  lrsListingUrl: "https://legalref.judiciary.hk/lrs/common/search/search_result.jsp",
  discoveredFrom: { profileId: "dccj-裝修", tier: "A" },
  fetchedAt: "2026-10-16T12:00:00.000Z",
});

const skip = ["CACC", "DCCC"];
const priority = ["HCSA", "DCCJ"];

describe("runD2Gates", () => {
  it("keeps sole proprietor when trade has engineering keyword on DCCJ", () => {
    const r = runD2Gates({
      row: baseRow("郭振強及另一人 對 陳國新經營燊記裝修水電工程"),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: {
        companyName: "陳國新經營燊記裝修水電工程",
        registrationNo: "MWC506/2014",
        ambiguous: false,
      },
    });
    expect(r.disposition).toBe("keep");
    expect(r.reasons).toContain("sole_proprietor_engineering_keep");
    expect(r.reviewLookupAliases).toContain("燊記裝修水電工程");
  });

  it("drops sole proprietor when trade lacks engineering keyword", () => {
    const r = runD2Gates({
      row: baseRow("甲 對 李四經營天天書店"),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("drop");
    expect(r.reasons).toContain("sole_proprietor_non_engineering_drop");
  });

  it("keeps company defendant with MWC enrich on DCCJ", () => {
    const r = runD2Gates({
      row: baseRow("郭振強 對 名富裝修工程有限公司"),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: {
        companyName: "名富裝修工程有限公司",
        registrationNo: "MWC506/2014",
        ambiguous: false,
      },
    });
    expect(r.disposition).toBe("keep");
  });

  it("keeps company defendant without MWC when renovation signal", () => {
    const r = runD2Gates({
      row: baseRow("業主 對 名富工程服務有限公司"),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("keep");
    expect(r.matchConfidence).toBe("high");
  });

  it("drops LDBM when OC applicant and defendant lacks engineering trade", () => {
    const r = runD2Gates({
      row: baseRow(
        "北角建業大廈業主立案法團 對 PROFIT WISDOM INVESTMENT LTD 及另一人",
        "LDBM 211/2014",
      ),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("drop");
    expect(r.reasons).toContain("ldbm_oc_applicant_defendant_not_contractor");
  });

  it("drops LDBM 6/1998 when no verified summary in SSOT", () => {
    const r = runD2Gates({
      row: baseRow(
        "德昌大廈業主立案法團(炮台街) 訴 成龍工程有限公司",
        "LDBM 6/1998",
      ),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("drop");
    expect(r.reasons).toContain("manual_triage_no_verified_summary");
  });

  it("drops CACV 131/2005 when no verified summary in SSOT", () => {
    const r = runD2Gates({
      row: baseRow(
        "THE INCORPORATED OWNERS OF THE COLONNADES 訴 GORDON TSO & CO LTD",
        "CACV 131/2005",
      ),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("drop");
    expect(r.reasons).toContain("manual_triage_no_verified_summary");
  });

  it("keeps CACV when defendant has engineering keyword", () => {
    const r = runD2Gates({
      row: baseRow("業主 對 名富工程服務有限公司", "CACV 12/2020"),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("keep");
  });

  it("reviews CACV with personal plaintiff unless defendant has work injury signal", () => {
    const r = runD2Gates({
      row: baseRow(
        "JOHN SMITH 訴 名富工程服務有限公司",
        "CACV 12/2020",
      ),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("review");
    expect(r.reasons).toContain("cacv_personal_plaintiff_review");
  });

  it("drops HCPI personal injury prefix", () => {
    const r = runD2Gates({
      row: baseRow("業主 對 名富工程服務有限公司", "HCPI 12/2020"),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("drop");
    expect(r.reasons).toContain("case_prefix_v3e_drop");
  });

  it("keeps mwc ambiguous sole prop when trade has engineering keyword", () => {
    const r = runD2Gates({
      row: baseRow("陳偉東及另一人 訴 黎天帶(經營榮利工程公司)", "DCCJ 6711/2002"),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: {
        companyName: "榮利工程公司",
        registrationNo: "MWC(W) 1/2020",
        ambiguous: true,
      },
    });
    expect(r.disposition).toBe("keep");
    expect(r.reasons).toContain("sole_proprietor_engineering_keep");
  });

  it("drops MWC plaintiff only when defendant lacks engineering keyword", () => {
    const r = runD2Gates({
      row: baseRow("陳國新經營燊記裝修水電工程 對 徐益民"),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: {
        companyName: "陳國新經營燊記裝修水電工程",
        registrationNo: "MWC506/2014",
        ambiguous: false,
      },
      mwcRight: null,
    });
    expect(r.disposition).toBe("drop");
    expect(r.reasons).toContain("mwc_plaintiff_only_pass");
  });

  it("keeps when plaintiff MWC hit but defendant label has engineering keyword", () => {
    const r = runD2Gates({
      row: baseRow("郭振強及另一人 對 陳國新經營燊記裝修水電工程"),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: {
        companyName: "郭振強",
        registrationNo: "MWC1/2020",
        ambiguous: false,
      },
      mwcRight: null,
    });
    expect(r.disposition).not.toBe("drop");
    expect(r.reasons).not.toContain("mwc_plaintiff_only_pass");
  });
});
