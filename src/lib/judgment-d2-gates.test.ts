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
  it("reviews sole proprietor with trade alias", () => {
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
    expect(r.disposition).toBe("review");
    expect(r.reasons).toContain("sole_proprietor_review");
    expect(r.reviewLookupAliases).toContain("燊記裝修水電工程");
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

  it("reviews CACV appeals", () => {
    const r = runD2Gates({
      row: baseRow("業主 對 名富工程服務有限公司", "CACV 12/2020"),
      skipPrefixes: skip,
      priorityPrefixes: priority,
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("review");
    expect(r.reasons).toContain("case_prefix_review_only");
  });

  it("drops MWC plaintiff only", () => {
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
});
