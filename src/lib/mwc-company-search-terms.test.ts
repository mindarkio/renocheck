import { describe, expect, it } from "vitest";
import {
  escapeIlikePattern,
  MAX_MWC_LOOKUP_TERMS,
  mwcCompanyNameLookupTerms,
  stripTrailingSearchFillers,
} from "./mwc-company-search-terms";

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

  it("adds 恒↔恆 (and the other variant pairs) after the original term", () => {
    const terms = mwcCompanyNameLookupTerms("恒偉工程公司");
    expect(terms[0]).toBe("恒偉工程公司");
    expect(terms).toContain("恆偉工程公司");
    expect(mwcCompanyNameLookupTerms("峯景工程")).toContain("峰景工程");
    expect(mwcCompanyNameLookupTerms("路綫工程")).toContain("路線工程");
    expect(mwcCompanyNameLookupTerms("裏海工程")).toContain("裡海工程");
    expect(mwcCompanyNameLookupTerms("附着工程")).toContain("附著工程");
  });

  it("removes spaces between CJK, including 有限 公司", () => {
    const terms = mwcCompanyNameLookupTerms("測試 有限 公司");
    expect(terms).toContain("測試 有限 公司");
    expect(terms).toContain("測試有限公司");
    const mixed = mwcCompanyNameLookupTerms("OMYL 工程");
    expect(mixed).toContain("OMYL 工程");
    expect(mixed).not.toContain("OMYL工程");
  });

  it("strips trailing filler words and keeps the original query", () => {
    for (const filler of ["判詞", "評價", "投訴", "好唔好"] as const) {
      const terms = mwcCompanyNameLookupTerms(`測試工程公司 ${filler}`);
      expect(terms).toContain(`測試工程公司 ${filler}`);
      expect(terms).toContain("測試工程公司");
    }
    const reno = mwcCompanyNameLookupTerms("測試工程裝修");
    expect(reno).toContain("測試工程裝修");
    expect(reno).toContain("測試工程");
  });

  it("escapes ILIKE wildcards without baking escapes into lookup terms", () => {
    expect(escapeIlikePattern("A_B%C\\D")).toBe("A\\_B\\%C\\\\D");
    const terms = mwcCompanyNameLookupTerms("A_B工程");
    expect(terms).toContain("A_B工程");
    expect(terms.some((term) => term.includes("\\"))).toBe(false);
  });

  it("maps PostgREST's * wildcard alias to a single-char match", () => {
    expect(escapeIlikePattern("A*B")).toBe("A_B");
    expect(escapeIlikePattern("A*B")).not.toContain("*");
  });

  it("does not strip a filler when only a generic 2-3 char stem would remain", () => {
    expect(stripTrailingSearchFillers("合成裝修")).toBe("合成裝修");
    expect(stripTrailingSearchFillers("合成判詞評價")).toBe("合成判詞");
    expect(mwcCompanyNameLookupTerms("合成裝修")).not.toContain("合成");
    expect(stripTrailingSearchFillers("測試工程裝修")).toBe("測試工程");
  });

  it("generates mixed variant-character forms", () => {
    expect(mwcCompanyNameLookupTerms("恒峯工程有限公司")).toEqual(
      expect.arrayContaining(["恆峯工程有限公司", "恒峰工程有限公司", "恆峰工程有限公司"]),
    );
  });

  it("caps variant expansion so one search cannot fan out into dozens of queries", () => {
    const terms = mwcCompanyNameLookupTerms("恒峯綫裏着合成工程有限公司");
    expect(terms.length).toBe(MAX_MWC_LOOKUP_TERMS);
    expect(terms[0]).toBe("恒峯綫裏着合成工程有限公司");
  });

  it("emits a fullwidth-digit term for a halfwidth query, original first", () => {
    const terms = mwcCompanyNameLookupTerms("創建21");
    expect(terms[0]).toBe("創建21");
    expect(terms).toContain("創建２１");
    expect(terms.some((term) => term.includes("%") || term.includes("*"))).toBe(
      false,
    );
  });

  it("NFKC-folds a fullwidth register-shaped query back to halfwidth digits", () => {
    const terms = mwcCompanyNameLookupTerms("創建２１顧問有限公司");
    expect(terms[0]).toBe("創建２１顧問有限公司");
    expect(terms).toContain("創建21顧問有限公司");
    expect(terms).toContain("創建21顧問");
  });

  it("collapses odd spaces around digits and emits both widths", () => {
    for (const typed of ["創建 21", "創建2 1", "創建 2 1", "創建２ １", "創建　２１"]) {
      const terms = mwcCompanyNameLookupTerms(typed);
      expect(terms[0]).toBe(typed);
      expect(terms).toContain("創建21");
      expect(terms).toContain("創建２１");
    }
    const inside = mwcCompanyNameLookupTerms("創建 21 工程");
    expect(inside).toContain("創建21工程");
    expect(inside).toContain("創建２１工程");
    expect(inside[0]).toBe("創建 21 工程");
  });

  it("NFKC-folds fullwidth Latin and still keeps a fullwidth-digit term", () => {
    const terms = mwcCompanyNameLookupTerms("ＡＢＣ２１工程");
    expect(terms[0]).toBe("ＡＢＣ２１工程");
    expect(terms).toContain("ABC21工程");
    expect(terms).toContain("ABC２１工程");
  });

  it("does not glue a Latin word space onto a digit", () => {
    const terms = mwcCompanyNameLookupTerms("OMYL 21 LTD");
    expect(terms).toContain("OMYL 21 LTD");
    expect(terms).toContain("OMYL ２１ LTD");
    expect(terms).not.toContain("OMYL21LTD");
    expect(terms).not.toContain("OMYL21 LTD");
    expect(terms).not.toContain("OMYL 21LTD");
  });
});
