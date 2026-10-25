import { describe, expect, it } from "vitest";
import {
  entityMatchTokens,
  extraSearchPhrases,
  isGenericSearchAlias,
  resolveBrandSerpSearchPhrase,
} from "./search-entity-labels";

describe("entityMatchTokens", () => {
  it("adds 良心裝修佬 heuristic for 良心裝修顧問", () => {
    const tokens = entityMatchTokens({
      companyName: "良心裝修顧問有限公司",
    });
    expect(tokens).toContain("良心裝修佬");
    expect(tokens.some((t) => t.includes("良心裝修"))).toBe(true);
  });

  it("resolves brand Serp phrase for 源始", () => {
    expect(
      resolveBrandSerpSearchPhrase("源始（國際）設計及裝修有限公司"),
    ).toBe("源始（國際）設計及裝修公司");
  });

  it("adds 源始 bracket tokens", () => {
    const tokens = entityMatchTokens({
      companyName: "源始（國際）設計及裝修有限公司",
    });
    expect(tokens).toContain("源始（國際）");
    expect(tokens).toContain("源始國際");
    expect(tokens).not.toContain("源始");
  });

  it("adds CR21 trade tokens for 創建２１ MWC name", () => {
    const tokens = entityMatchTokens(
      { companyName: "創建 2 1 顧問有限公司" },
      { mwcCompanyName: "創建２１顧問有限公司" },
    );
    expect(tokens).toContain("CR21康藝家居");
    expect(tokens).toContain("創建21顧問有限公司");
  });

  it("resolves brand Serp phrase for 創建21 (matches Google copy)", () => {
    expect(resolveBrandSerpSearchPhrase("創建２１顧問有限公司")).toBe(
      "創建21顧問有限公司",
    );
  });

  it("uses MWC name for phone-only input", () => {
    const tokens = entityMatchTokens(
      { phone: "91234567" },
      { mwcCompanyName: "雅達居裝修傢俬工程公司", phoneNormalized: "91234567" },
    );
    expect(tokens.some((t) => t.includes("雅達居"))).toBe(true);
  });

  it("adds the typed brand for 齊來設計居+屋 and keeps the register English name", () => {
    const opts = {
      mwcCompanyName: "齊來設計居+屋有限公司",
      mwcCompanyNameEn: "Dimensions Interiors Limited",
    };
    expect(extraSearchPhrases({ companyName: "齊來設計" }, opts)).toEqual([
      "齊來設計",
      "Dimensions Interiors Limited",
    ]);
    const tokens = entityMatchTokens({ companyName: "齊來設計" }, opts);
    expect(tokens).toContain("齊來設計");
    expect(tokens).toContain("Dimensions Interiors Limited");
    expect(tokens).toContain("齊來設計居+屋有限公司");
  });

  it("does not truncate an English name to 6 characters and matches case-insensitively", () => {
    const tokens = entityMatchTokens(
      { companyName: "hang wai engineering" },
      {
        mwcCompanyName: "恆偉工程公司",
        mwcCompanyNameEn: "HANG WAI ENGINEERING LIMITED",
      },
    );
    expect(tokens).toContain("hang wai engineering");
    expect(tokens).toContain("HANG WAI ENGINEERING LIMITED");
    expect(tokens).not.toContain("HANG W");
    expect(entityMatchTokens({ companyName: "HANG WAI ENGINEERING LIMITED" })).not.toContain(
      "HANG W",
    );
  });

  it("rejects generic typed fragments", () => {
    const legal = { mwcCompanyName: "齊來設計居+屋有限公司" };
    for (const typed of ["設計", "裝修", "工程", "裝修工程", "Engineering"]) {
      expect(isGenericSearchAlias(typed)).toBe(true);
      expect(extraSearchPhrases({ companyName: typed }, legal)).toEqual([]);
      expect(entityMatchTokens({ companyName: typed }, legal)).not.toContain(typed);
    }
    expect(
      extraSearchPhrases(
        { companyName: "Engineering" },
        { ...legal, mwcCompanyNameEn: "ENGINEERING LIMITED" },
      ),
    ).toEqual([]);
  });

  it("drops the typed alias when several register rows contain it", () => {
    const opts = {
      mwcCompanyName: "齊來設計居+屋有限公司",
      mwcCompanyNameEn: "Dimensions Interiors Limited",
      mwcAmbiguous: true,
    };
    expect(extraSearchPhrases({ companyName: "齊來設計" }, opts)).toEqual([
      "Dimensions Interiors Limited",
    ]);
    expect(entityMatchTokens({ companyName: "齊來設計" }, opts)).not.toContain("齊來設計");
  });

  it("rejects trade-word, suffix-tail, and Simplified generic fragments", () => {
    const cases: Array<[string, string]> = [
      ["家居設計", "雅家居設計有限公司"],
      ["建築工程", "明建築工程有限公司"],
      ["機電工程", "新城機電工程有限公司"],
      ["装修工程", "森源装修工程有限公司"],
      ["一站式設計", "一站式設計裝修有限公司"],
      ["全屋翻新", "華麗全屋翻新有限公司"],
      ["程有限公司", "明建築工程有限公司"],
      ["計有限公司", "雅家居設計有限公司"],
      ["設計及裝修工程", "甲設計及裝修工程有限公司"],
    ];
    for (const [typed, legal] of cases) {
      expect(extraSearchPhrases({ companyName: typed }, { mwcCompanyName: legal })).toEqual([]);
      expect(entityMatchTokens({ companyName: typed }, { mwcCompanyName: legal })).not.toContain(
        typed,
      );
    }
  });

  it("enforces the 4-CJK / 6-Latin floors, the legal-name check, and dedupe", () => {
    const legal = { mwcCompanyName: "齊來設計居+屋有限公司" };
    expect(extraSearchPhrases({ companyName: "齊來設" }, legal)).toEqual([]);
    expect(
      extraSearchPhrases({ companyName: "AB康藝" }, { mwcCompanyName: "AB康藝家居有限公司" }),
    ).toEqual([]);
    expect(
      extraSearchPhrases({ companyName: "ABCD康藝" }, { mwcCompanyName: "ABCD康藝家居有限公司" }),
    ).toEqual(["ABCD康藝"]);
    expect(extraSearchPhrases({ companyName: "設計設計" }, { mwcCompanyName: "甲設計設計有限公司" })).toEqual([]);
    expect(extraSearchPhrases({ companyName: "齊來工作室" }, legal)).toEqual([]);
    expect(extraSearchPhrases({ companyName: "齊來設計居+屋" }, legal)).toEqual([]);
    expect(
      extraSearchPhrases(
        { companyName: "ABC Studio Limited" },
        { mwcCompanyName: "ABC Studio Limited", mwcCompanyNameEn: "ABC Studio Limited" },
      ),
    ).toEqual([]);
    expect(
      extraSearchPhrases(
        { companyName: "齊來設計" },
        { ...legal, mwcCompanyNameEn: "Design Interiors Limited" },
      ),
    ).toEqual(["齊來設計"]);
    // Greedy splitting fails here (interiors + ervices); any split counts.
    expect(isGenericSearchAlias("Interior Services")).toBe(true);
    expect(
      extraSearchPhrases(
        { companyName: "齊來設計" },
        { ...legal, mwcCompanyNameEn: "Interior Services Limited" },
      ),
    ).toEqual(["齊來設計"]);
  });

  it("only uses a Latin-only typed alias when it is the whole English name", () => {
    const opts = {
      mwcCompanyName: "齊來設計居+屋有限公司",
      mwcCompanyNameEn: "Dimensions Interiors Limited",
    };
    for (const typed of ["Dimensions", "dimensions interior", "Interiors Limited"]) {
      expect(extraSearchPhrases({ companyName: typed }, opts)).toEqual([
        "Dimensions Interiors Limited",
      ]);
    }
    expect(extraSearchPhrases({ companyName: "DIMENSIONS INTERIORS" }, opts)).toEqual([
      "DIMENSIONS INTERIORS",
      "Dimensions Interiors Limited",
    ]);
    expect(
      extraSearchPhrases(
        { companyName: "Modern" },
        { mwcCompanyName: "摩登生活設計有限公司", mwcCompanyNameEn: "Modern Living Design Limited" },
      ),
    ).toEqual(["Modern Living Design Limited"]);
  });
});
