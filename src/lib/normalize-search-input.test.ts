import { describe, expect, it } from "vitest";
import { normalizeSearchInput } from "./normalize-search-input";

describe("normalizeSearchInput register pick", () => {
  it("keeps a trimmed pick only for a company-name search", () => {
    expect(
      normalizeSearchInput({ companyName: "合成設計", mwcRegistrationNo: " MWC 1/2026 " }),
    ).toMatchObject({ matchType: "company_name", mwcRegistrationNo: "MWC 1/2026" });
    expect(
      normalizeSearchInput({ companyName: "合成設計", phone: "91234567", mwcRegistrationNo: "MWC 1/2026" }),
    ).not.toHaveProperty("mwcRegistrationNo");
    expect(
      normalizeSearchInput({ br: "12345678", mwcRegistrationNo: "MWC 1/2026" }),
    ).not.toHaveProperty("mwcRegistrationNo");
  });
});
