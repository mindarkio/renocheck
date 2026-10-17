import { describe, expect, it } from "vitest";
import { loadCauseListFixtureHtml } from "./fixtures/load-fixture-html";
import { CAUSE_LIST_COMPANY_FIXTURES } from "./fixtures/companies.fixture";
import { parseSmtCauseListHtml } from "./parse-smt";
import { parseDcCauseListHtml } from "./parse-dc";
import { parseCacfiCauseListHtml } from "./parse-cacfi";
import { parseLandsCauseListHtml } from "./parse-lands";
import { matchCauseListCases, summarizeMatchesByLevel } from "./match";
import type { ParsedCauseListCase } from "./types";

const DATE = "16102026";

function smtDefendantCase(caseNo: string, rawName: string): ParsedCauseListCase {
  return {
    court: "SMT",
    caseNo,
    hearingDate: "2026-10-16",
    claimNature: "Work Done",
    parties: [{ role: "defendant", rawName }],
  };
}

describe("cause-list matcher (exact)", () => {
  it("SMT: exact A, t/a B, person dropped, renovation contribution excluded", () => {
    const { cases } = parseSmtCauseListHtml(loadCauseListFixtureHtml("smt"), DATE);
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
    expect(matches.some((m) => m.case.caseNo === "SCTC 2/2026")).toBe(false);
    expect(summary.A).toBeGreaterThanOrEqual(1);
  });

  it("dedupes same court/case/company", () => {
    const { cases } = parseSmtCauseListHtml(loadCauseListFixtureHtml("smt"), DATE);
    const doubled = [...cases, ...cases];
    const matches = matchCauseListCases(doubled, CAUSE_LIST_COMPANY_FIXTURES);
    const keys = new Set(matches.map((m) => `${m.case.court}|${m.case.caseNo}|${m.companyId}`));
    expect(keys.size).toBe(matches.length);
  });

  it("omits natural person names from serialized matches", () => {
    const { cases } = parseSmtCauseListHtml(loadCauseListFixtureHtml("smt"), DATE);
    const matches = matchCauseListCases(cases, CAUSE_LIST_COMPANY_FIXTURES);
    const blob = JSON.stringify(matches);
    expect(blob).not.toContain("FAKE PERSON ALPHA");
  });

  it("DC: includes DCCJ defendant, excludes DCEC", () => {
    const { cases } = parseDcCauseListHtml(loadCauseListFixtureHtml("dc"), DATE);
    const matches = matchCauseListCases(cases, CAUSE_LIST_COMPANY_FIXTURES);
    expect(matches.some((m) => m.case.caseNo === "DCCJ 5500/2026")).toBe(true);
    expect(matches.some((m) => m.case.caseNo === "DCEC 1200/2026")).toBe(false);
  });

  it("CACFI: HCA bilingual defendant", () => {
    const { cases } = parseCacfiCauseListHtml(loadCauseListFixtureHtml("cacfi"), DATE);
    const matches = matchCauseListCases(cases, CAUSE_LIST_COMPANY_FIXTURES);
    expect(matches.some((m) => m.case.caseNo === "HCA 88/2026")).toBe(true);
  });

  it("LANDS: LDBM respondent only", () => {
    const { cases } = parseLandsCauseListHtml(loadCauseListFixtureHtml("lands"), DATE);
    const matches = matchCauseListCases(cases, CAUSE_LIST_COMPANY_FIXTURES);
    expect(matches.some((m) => m.case.caseNo === "LDBM 201/2026")).toBe(true);
    expect(matches.every((m) => m.party.role === "respondent")).toBe(true);
  });

  it("zh regional strict vs alias B and core C", () => {
    const cases = [
      smtDefendantCase("SCTC 90001/2026", "示例工程（香港）有限公司"),
      smtDefendantCase("SCTC 90002/2026", "示例光伏科技（香港）有限公司"),
      smtDefendantCase("SCTC 90003/2026", "示例光伏科技有限公司"),
      smtDefendantCase("SCTC 90004/2026", "示例光伏科枝有限公司"),
    ];
    const matches = matchCauseListCases(cases, CAUSE_LIST_COMPANY_FIXTURES);

    const hkMega = matches.find((m) => m.case.caseNo === "SCTC 90001/2026");
    expect(hkMega?.companyId).toBe("fixture-mega-eng");
    expect(hkMega?.confidence).toBe("B");

    const hkSolar = matches.find((m) => m.case.caseNo === "SCTC 90002/2026");
    expect(hkSolar?.companyId).toBe("fixture-solar-tech");
    expect(hkSolar?.confidence).toBe("C");
    expect(hkSolar?.reviewOnly).toBe(true);

    const solarA = matches.find((m) => m.case.caseNo === "SCTC 90003/2026");
    expect(solarA?.companyId).toBe("fixture-solar-tech");
    expect(solarA?.confidence).toBe("A");

    const solarTypo = matches.find((m) => m.case.caseNo === "SCTC 90004/2026");
    expect(solarTypo?.companyId).toBe("fixture-solar-tech");
    expect(solarTypo?.confidence).toBe("C");
  });

  it("formerlyTradedAs: no match on non-registry legal; A on registry legal", () => {
    const noMatch = matchCauseListCases(
      [
        smtDefendantCase(
          "SCTC 90010/2026",
          "OTHER HOLDINGS LIMITED 前經營 FICTIVE MEGA ENGINEERING LIMITED",
        ),
      ],
      CAUSE_LIST_COMPANY_FIXTURES,
    );
    expect(noMatch).toEqual([]);

    const yesMatch = matchCauseListCases(
      [
        smtDefendantCase(
          "SCTC 90011/2026",
          "FICTIVE MEGA ENGINEERING LIMITED 前經營 XYZ DECOR",
        ),
      ],
      CAUSE_LIST_COMPANY_FIXTURES,
    );
    expect(yesMatch).toHaveLength(1);
    expect(yesMatch[0].confidence).toBe("A");
    expect(yesMatch[0].companyId).toBe("fixture-mega-eng");
    expect(yesMatch[0].party.formerlyTradedAs).toBe(true);
  });
});
