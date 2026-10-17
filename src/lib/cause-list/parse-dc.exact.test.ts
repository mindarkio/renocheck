import { describe, expect, it } from "vitest";
import { loadCauseListFixtureHtml } from "./fixtures/load-fixture-html";
import { parseDcCauseListHtml } from "./parse-dc";

describe("parseDcCauseListHtml (exact)", () => {
  it("parses DCCJ and DCEC rows", () => {
    const cases = parseDcCauseListHtml(loadCauseListFixtureHtml("dc"), "16102026");
    expect(cases.map((c) => c.caseNo)).toEqual(["DCCJ 5500/2026", "DCEC 1200/2026"]);
  });
});
