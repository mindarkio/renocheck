import { describe, expect, it } from "vitest";
import { loadCauseListFixtureHtml } from "./fixtures/load-fixture-html";
import { parseCacfiCauseListHtml } from "./parse-cacfi";

describe("parseCacfiCauseListHtml (exact)", () => {
  it("parses HCA and HCCT rows", () => {
    const { cases } = parseCacfiCauseListHtml(loadCauseListFixtureHtml("cacfi"), "16102026");
    expect(cases.map((c) => c.caseNo)).toEqual(["HCA 88/2026", "HCCT 12/2026"]);
  });
});
