import { describe, expect, it } from "vitest";
import {
  aggregateCorporateDefendantRows,
  backfillRowsToCsv,
  buildBackfillSummary,
} from "./backfill-report";
import { CAUSE_LIST_COMPANY_FIXTURES } from "./fixtures/companies.fixture";
import type { ParsedCauseListCase } from "./types";

const PERSON_A = "SYNTHETIC PERSON ALPHA";
const PERSON_B = "SYNTHETIC PERSON BETA";

function smtCase(
  caseNo: string,
  hearingDate: string,
  defendant: string,
  claimNature = "Work Done",
): ParsedCauseListCase {
  return {
    court: "SMT",
    caseNo,
    hearingDate,
    claimNature,
    parties: [
      { role: "claimant", rawName: PERSON_A },
      { role: "defendant", rawName: defendant },
    ],
  };
}

describe("cause-list backfill rows", () => {
  it("keeps corporate defendants, merges hearings, and drops natural persons", () => {
    const { rows, byCourt } = aggregateCorporateDefendantRows(
      [
        smtCase("SCTC 1/2024", "2024-12-02", "FICTIVE MEGA ENGINEERING LIMITED"),
        smtCase("SCTC 1/2024", "2024-11-06", "FICTIVE MEGA ENGINEERING LIMITED"),
        smtCase("SCTC 1/2024", "2024-11-06", PERSON_B),
        smtCase("SCTC 3/2024", "2024-11-06", "OTHER HOLDINGS LIMITED"),
        smtCase("SCTC 9/2024", "2024-11-06", "FICTIVE MEGA ENGINEERING LIMITED", "維修費"),
        {
          court: "SMT",
          caseNo: "SCTC 4/2024",
          hearingDate: "2024-11-06",
          claimNature: "Work Done",
          parties: [{ role: "claimant", rawName: "SYNTHETIC CLAIMANT LIMITED" }],
        },
      ],
      CAUSE_LIST_COMPANY_FIXTURES,
    );

    expect(byCourt.SMT.corporateRenovationRelevantRows).toBe(3);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      court: "SMT",
      caseNo: "SCTC 1/2024",
      firstHearingDate: "2024-11-06",
      lastHearingDate: "2024-12-02",
      companyName: "FICTIVE MEGA ENGINEERING LIMITED",
      role: "defendant",
      matchLevel: "A",
      matchedCompanyId: "fixture-mega-eng",
    });
    expect(rows[1]).toMatchObject({
      caseNo: "SCTC 3/2024",
      matchLevel: "unmatched",
      matchedCompanyId: "",
    });

    const csv = backfillRowsToCsv(rows);
    expect(csv.startsWith(
      "court,caseNo,firstHearingDate,lastHearingDate,claimNature,companyName,role,matchLevel,matchedCompanyId\n",
    )).toBe(true);
    expect(csv).not.toContain(PERSON_A);
    expect(csv).not.toContain(PERSON_B);
    expect(csv).not.toContain("SYNTHETIC CLAIMANT LIMITED");
  });

  it("summarises A/B/C/unmatched without listing people", () => {
    const { rows } = aggregateCorporateDefendantRows(
      [smtCase("SCTC 1/2024", "2024-11-06", "FICTIVE MEGA ENGINEERING LIMITED")],
      CAUSE_LIST_COMPANY_FIXTURES,
    );
    const summary = buildBackfillSummary({
      from: "2024-11-01",
      to: "2024-11-30",
      generatedAt: "2026-10-17T00:00:00.000Z",
      complete: true,
      mwcMode: "offline-public-register",
      corporateCompanies: 1,
      snapshots: [
        {
          court: "SMT",
          dateDdMmYyyy: "06112024",
          iso: "2024-11-06",
          timestamp: "20241106120000",
          original: "https://e-services.judiciary.hk/dcl/view.jsp?date=06112024&court=SMT",
        },
      ],
      fetchedKeys: new Set(["SMT|06112024"]),
      rowsParsed: { SMT: 4, DC: 0, CACFI: 0, LANDS: 0 },
      corporateRenovationRelevantRows: { SMT: 1, DC: 0, CACFI: 0, LANDS: 0 },
      rows,
      pages: { empty: 0, unsupported: 0, legacyFormat: 0, parseFailures: 0, fetchFailures: 0 },
      parseFailures: [],
    });
    expect(summary.courts.SMT).toMatchObject({
      datesFoundInCdx: 1,
      datesFetched: 1,
      rowsParsed: 4,
      corporateRenovationRelevantRows: 1,
      dedupedCases: 1,
      A: 1,
      B: 0,
      C: 0,
      unmatched: 0,
    });
    expect(summary.totals.distinctCompaniesA).toBe(1);
    expect(JSON.stringify(summary)).not.toContain(PERSON_A);
  });
});
