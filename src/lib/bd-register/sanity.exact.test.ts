import { describe, expect, it } from "vitest";
import { assertBdCsvSanity } from "./sanity";

describe("assertBdCsvSanity", () => {
  it("accepts full-list scale after B1 (17145 unique / 4341 MWC companies)", () => {
    expect(() =>
      assertBdCsvSanity({ entries: 17_145, mwcCompanies: 4_341 }),
    ).not.toThrow();
  });

  it("throws when MWC companies below 3000", () => {
    expect(() =>
      assertBdCsvSanity({ entries: 17_145, mwcCompanies: 2_999 }),
    ).toThrow(/BD CSV sanity: too few rows/);
  });

  it("throws when unique entries below 10000", () => {
    expect(() =>
      assertBdCsvSanity({ entries: 9_999, mwcCompanies: 4_341 }),
    ).toThrow(/BD CSV sanity: too few rows/);
  });
});
