import { describe, expect, it } from "vitest";
import { parseUnifiedSearchQuery } from "./parse-unified-search-query";

describe("parseUnifiedSearchQuery", () => {
  it("parses HK phone", () => {
    expect(parseUnifiedSearchQuery("9123 4567")).toEqual({
      kind: "phone",
      phone: "9123 4567",
    });
  });

  it("parses BR with prefix", () => {
    expect(parseUnifiedSearchQuery("BR 12345678")).toEqual({
      kind: "br",
      br: "12345678",
    });
  });

  it("parses BR certificate style", () => {
    expect(parseUnifiedSearchQuery("12345678-000")).toEqual({
      kind: "br",
      br: "12345678-000",
    });
  });

  it("parses company name", () => {
    expect(parseUnifiedSearchQuery("輝煌裝修工程有限公司")).toEqual({
      kind: "company_name",
      companyName: "輝煌裝修工程有限公司",
    });
  });

  it("treats 8-digit starting with 1 as BR when not mobile pattern", () => {
    const out = parseUnifiedSearchQuery("12345678");
    expect(out.kind).toBe("br");
  });

  it("treats 8-digit mobile as phone", () => {
    expect(parseUnifiedSearchQuery("61234567").kind).toBe("phone");
  });
});
