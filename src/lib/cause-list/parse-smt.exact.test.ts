import { describe, expect, it } from "vitest";
import { loadCauseListFixtureHtml } from "./fixtures/load-fixture-html";
import { parseSmtCauseListHtml } from "./parse-smt";
import { isRenovationRelevantCase } from "./filter";
import { parseCorporateParties } from "./party";

const DATE = "16102026";

describe("parseSmtCauseListHtml (exact)", () => {
  it("parses synthetic SMT rows", () => {
    const { cases } = parseSmtCauseListHtml(loadCauseListFixtureHtml("smt"), DATE);
    expect(cases.map((c) => c.caseNo)).toEqual([
      "SCTC 10001/2026",
      "SCTC 10002/2026",
      "SCTC 10003/2026",
      "SCTC 10004/2026",
      "SCTC 10005/2026",
      "SCTC 10006/2026",
    ]);
    expect(cases[0].claimNature).toContain("Work Done");
    expect(cases[0].hearingDate).toBe("2026-10-16");
  });

  it("excludes renovation contribution nature", () => {
    const { cases } = parseSmtCauseListHtml(loadCauseListFixtureHtml("smt"), DATE);
    const ioLevy = cases.find((c) => c.caseNo === "SCTC 10003/2026");
    expect(ioLevy).toBeDefined();
    expect(isRenovationRelevantCase(ioLevy!)).toBe(false);
  });

  it("drops natural person defendant", () => {
    const { cases } = parseSmtCauseListHtml(loadCauseListFixtureHtml("smt"), DATE);
    const row = cases.find((c) => c.caseNo === "SCTC 10002/2026")!;
    const defendants = row.parties.filter((p) => p.role === "defendant");
    const corps = parseCorporateParties(defendants);
    expect(corps).toHaveLength(0);
  });
});
