import { describe, expect, it } from "vitest";
import { loadCauseListFixtureHtml } from "./fixtures/load-fixture-html";
import { parseLandsCauseListHtml } from "./parse-lands";

describe("parseLandsCauseListHtml (exact)", () => {
  it("parses LDBM applicant/respondent rows", () => {
    const cases = parseLandsCauseListHtml(loadCauseListFixtureHtml("lands"), "16102026");
    expect(cases.map((c) => c.caseNo)).toEqual(["LDBM 200/2026", "LDBM 201/2026"]);
  });
});
