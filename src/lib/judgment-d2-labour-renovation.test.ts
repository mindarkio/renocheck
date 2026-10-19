import { describe, expect, it } from "vitest";
import { runD2Gates } from "./judgment-d2-gates";
import type { JudgmentCandidateRow } from "./judgment-candidates-schema";
import {
  isLabourRenovationCandidate,
  labourJudgmentRenovationContext,
} from "./judgment-d2-labour-renovation";

const baseRow = (
  partiesLine: string,
  caseRef: string,
): JudgmentCandidateRow => ({
  caseRef,
  eventDate: "2025-01-15",
  partiesLine,
  database: "Judgments",
  lrsListingUrl:
    "https://legalref.judiciary.hk/lrs/common/search/search_result.jsp",
  discoveredFrom: { profileId: "hcla-labour", tier: "A" },
  fetchedAt: "2026-10-19T12:00:00.000Z",
});

const partiesEngineering =
  "申索人甲及另二人 對 ZZQ工程服務有限公司";
const partiesTrade = "申索人乙 對 ZZQ貿易有限公司";
const partiesDcec = "申索人丙 對 ZZQ工程有限公司";

describe("judgment-d2-labour-renovation", () => {
  it("runD2Gates: HCLA901/2024 engineering defendant → review", () => {
    const r = runD2Gates({
      row: baseRow(partiesEngineering, "HCLA901/2024"),
      skipPrefixes: [],
      priorityPrefixes: [],
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("review");
    expect(r.reasons).toEqual(["employment_renovation_review"]);
    expect(r.reviewJudgmentCategory).toBe("employment_renovation");
  });

  it("runD2Gates: HCLA23/2024 verified → keep", () => {
    const r = runD2Gates({
      row: baseRow(partiesEngineering, "HCLA23/2024"),
      skipPrefixes: [],
      priorityPrefixes: [],
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("keep");
    expect(r.reasons).toEqual(["employment_renovation_keep"]);
    expect(r.reviewJudgmentCategory).toBe("employment_renovation");
  });

  it("runD2Gates: non-engineering HCLA → employment_labour_dropped", () => {
    const r = runD2Gates({
      row: baseRow(partiesTrade, "HCLA902/2024"),
      skipPrefixes: [],
      priorityPrefixes: [],
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("drop");
    expect(r.reasons).toEqual(["employment_labour_dropped"]);
  });

  it("runD2Gates: DCEC engineering → employment_labour_dropped", () => {
    const r = runD2Gates({
      row: baseRow(partiesDcec, "DCEC901/2024"),
      skipPrefixes: [],
      priorityPrefixes: [],
      mwcLeft: null,
      mwcRight: null,
    });
    expect(r.disposition).toBe("drop");
    expect(r.reasons).toEqual(["employment_labour_dropped"]);
  });

  it("labourJudgmentRenovationContext: renovation chain → ok", () => {
    const ctx = labourJudgmentRenovationContext(
      "被告為該裝修工程的總承判商，須按《僱傭條例》第43C條支付工資",
    );
    expect(ctx.ok).toBe(true);
  });

  it("labourJudgmentRenovationContext: office clerk → not ok", () => {
    const ctx = labourJudgmentRenovationContext(
      "申索人任職被告寫字樓會計文員，追討年假及代通知金",
    );
    expect(ctx.ok).toBe(false);
  });

  it("isLabourRenovationCandidate: HCLA + company + engineering", () => {
    expect(
      isLabourRenovationCandidate({
        caseRef: "HCLA1/2024",
        defendantLabel: "ZZQ工程服務有限公司",
        entityKind: "company",
      }),
    ).toBe(true);
  });
});
