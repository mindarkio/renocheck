import { describe, expect, it } from "vitest";
import {
  buildEntitySearchQueries,
  buildPhoneAnchorQuery,
  buildWebSearchQuery,
} from "./web-search";

describe("buildWebSearchQuery", () => {
  it("includes threads sites in Q1", () => {
    const q = buildWebSearchQuery({ companyName: "測試公司" });
    expect(q).toContain("threads.net");
    expect(q).toContain("threads.com");
  });
  it("uses MWC company name when search is phone-only", () => {
    const q = buildWebSearchQuery(
      { phone: "91234567" },
      { mwcCompanyName: "雅達居裝修傢俬工程公司" },
    );
    expect(q).toContain("雅達居裝修傢俬工程公司");
    expect(q).not.toContain("91234567");
  });

  it("prefers MWC company name when registered (DEC-0004)", () => {
    const q = buildWebSearchQuery(
      { companyName: "用戶輸入名" },
      { mwcCompanyName: "名冊名" },
    );
    expect(q).toContain("名冊名");
    expect(q).not.toContain("用戶輸入名");
  });
});

describe("buildPhoneAnchorQuery", () => {
  it("quotes phone and avoids banned Serp terms", () => {
    const q = buildPhoneAnchorQuery("92805455");
    expect(q).toContain('"92805455"');
    expect(q).toContain("裝修");
    expect(q).not.toContain("黑店");
  });
});

describe("buildEntitySearchQueries", () => {
  it("returns Q1 and loose Q2 (production)", () => {
    const [q1, q2] = buildEntitySearchQueries({ companyName: "甲公司" });
    expect(q1).toContain("site:lihkg.com");
    expect(q1).toContain('"甲公司"');
    expect(q2).not.toContain("site:lihkg.com");
    expect(q2).not.toMatch(/^"甲公司"/);
    expect(q2).toContain("甲公司");
  });

  it("Q1 uses halfwidth 創建21 phrase for MWC fullwidth name", () => {
    const q1 = buildWebSearchQuery(
      { companyName: "創建 2 1 顧問有限公司" },
      { mwcCompanyName: "創建２１顧問有限公司" },
    );
    expect(q1).toContain('"創建21顧問有限公司"');
    expect(q1).not.toContain("２１");
  });

  it("loose Q2 uses brand phrase for 源始 (forum copy omits 有限公司)", () => {
    const q2 = buildEntitySearchQueries({
      companyName: "源始（國際）設計及裝修有限公司",
    })[1];
    expect(q2).toContain("源始（國際）設計及裝修公司");
    expect(q2).not.toContain('"源始" "國際"');
  });
});

