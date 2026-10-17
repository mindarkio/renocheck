import { describe, expect, it } from "vitest";
import { mwcCompanyNameLookupTerms } from "./mwc-company-search-terms";

describe("mwcCompanyNameLookupTerms", () => {
  it("includes full name and bracket-normalized variants", () => {
    const terms = mwcCompanyNameLookupTerms("源始（國際）設計及裝修有限公司");
    expect(terms).toContain("源始（國際）設計及裝修有限公司");
    expect(terms.some((t) => t.includes("源始(國際)"))).toBe(true);
    expect(terms.some((t) => t.includes("源始") && !t.includes("（"))).toBe(
      true,
    );
  });

  it("dedupes identical variants", () => {
    const terms = mwcCompanyNameLookupTerms("甲公司有限公司");
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("expands LTD and decodes &amp;", () => {
    const terms = mwcCompanyNameLookupTerms("GORDON TSO &amp; CO LTD");
    expect(terms.some((t) => /LIMITED/i.test(t))).toBe(true);
    expect(terms.some((t) => t.includes("&"))).toBe(true);
  });
});
