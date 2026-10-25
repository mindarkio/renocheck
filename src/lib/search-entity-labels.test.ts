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
      { companyName: "hang wai" },
      {
        mwcCompanyName: "恆偉工程公司",
        mwcCompanyNameEn: "HANG WAI ENGINEERING LIMITED",
      },
    );
    expect(tokens).toContain("hang wai");
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
});
