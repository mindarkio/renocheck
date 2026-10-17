import { describe, expect, it } from "vitest";
import { loadCauseListFixtureHtml } from "./fixtures/load-fixture-html";
import { CAUSE_LIST_COMPANY_FIXTURES } from "./fixtures/companies.fixture";
import { parseSmtCauseListHtml } from "./parse-smt";
import { parseDcCauseListHtml } from "./parse-dc";
import { parseCacfiCauseListHtml } from "./parse-cacfi";
import { parseLandsCauseListHtml } from "./parse-lands";
import { matchCauseListCases, summarizeMatchesByLevel } from "./match";

const DATE = "16102026";

describe("cause-list matcher (exact)", () => {
  it("SMT: exact A, t/a B, person dropped, renovation contribution excluded", () => {
    const cases = parseSmtCauseListHtml(loadCauseListFixtureHtml("smt"), DATE);
    const matches = matchCauseListCases(cases, CAUSE_LIST_COMPANY_FIXTURES);
    const summary = summarizeMatchesByLevel(matches);

    expect(
      matches.some(
        (m) =>
          m.case.caseNo === "SCTC 10001/2026" &&
          (m.confidence === "A" || m.confidence === "B"),
      ),
    ).toBe(true);
    expect(matches.some((m) => m.case.caseNo === "SCTC 10004/2026")).toBe(true);
    expect(matches.some((m) => m.case.caseNo === "SCTC 10002/2026")).toBe(false);
    expect(matches.some((m) => m.case.caseNo === "SCTC 10003/2026")).toBe(false);
    expect(matches.some((m) => m.case.caseNo === "SCTC 10005/2026")).toBe(true);
    expect(summary.A).toBeGreaterThanOrEqual(1);
  });

  it("DC: includes DCCJ defendant, excludes DCEC", () => {
    const cases = parseDcCauseListHtml(loadCauseListFixtureHtml("dc"), DATE);
    const matches = matchCauseListCases(cases, CAUSE_LIST_COMPANY_FIXTURES);
    expect(matches.some((m) => m.case.caseNo === "DCCJ 5500/2026")).toBe(true);
    expect(matches.some((m) => m.case.caseNo === "DCEC 1200/2026")).toBe(false);
  });

  it("CACFI: HCA bilingual defendant", () => {
    const cases = parseCacfiCauseListHtml(loadCauseListFixtureHtml("cacfi"), DATE);
    const matches = matchCauseListCases(cases, CAUSE_LIST_COMPANY_FIXTURES);
    expect(matches.some((m) => m.case.caseNo === "HCA 88/2026")).toBe(true);
  });

  it("LANDS: LDBM respondent only", () => {
    const cases = parseLandsCauseListHtml(loadCauseListFixtureHtml("lands"), DATE);
    const matches = matchCauseListCases(cases, CAUSE_LIST_COMPANY_FIXTURES);
    expect(matches.some((m) => m.case.caseNo === "LDBM 201/2026")).toBe(true);
    expect(matches.every((m) => m.party.role === "respondent")).toBe(true);
  });
});
