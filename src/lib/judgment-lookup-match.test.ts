import { describe, expect, it } from "vitest";
import {
  legalRowMatchesSearchLabel,
  suggestLookupAliases,
} from "./judgment-lookup-match";

describe("suggestLookupAliases", () => {
  it("extracts trade name after 經營", () => {
    const aliases = suggestLookupAliases("楊國聰經營新寶燈飾裝修工程公司");
    expect(aliases).toContain("新寶燈飾裝修工程公司");
  });

  it("extracts t/a name", () => {
    const aliases = suggestLookupAliases("LAM YIU FAI t/a ART CITY ENGINEERING CO");
    expect(aliases.some((a) => a.includes("ART CITY"))).toBe(true);
  });
});

describe("legalRowMatchesSearchLabel", () => {
  it("matches trade via aliases for sole proprietorship rows", () => {
    const row = {
      company_name_normalized: "新寶燈飾裝修工程公司",
      lookup_aliases: ["新寶燈飾裝修工程公司"],
      topic_tags: ["sole_proprietorship"],
    };
    expect(legalRowMatchesSearchLabel("新寶燈飾裝修工程公司", row)).toBe(true);
    expect(legalRowMatchesSearchLabel("楊國聰", row)).toBe(false);
  });

  it("matches company row via company_name_normalized", () => {
    const row = {
      company_name_normalized: "名富裝修工程有限公司",
      lookup_aliases: [],
      topic_tags: [],
    };
    expect(legalRowMatchesSearchLabel("名富裝修工程", row)).toBe(true);
  });

  it("matches MWC(W) individual name (3 CJK chars)", () => {
    const row = {
      company_name_normalized: "鍾灼偉",
      lookup_aliases: [],
    };
    expect(legalRowMatchesSearchLabel("鍾灼偉", row)).toBe(true);
  });
});
