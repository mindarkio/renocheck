import { describe, expect, it } from "vitest";
import { MwcContractorsMemoryIndex } from "./mwc-contractors-memory-index";
import { companyNameOnlySearchInput } from "./normalize-search-input";

describe("MwcContractorsMemoryIndex", () => {
  const index = new MwcContractorsMemoryIndex([
    {
      company_name: "名富裝修工程有限公司",
      phone: null,
      registration_no: "MWC 506/2014",
      expiry_date: null,
      primary_signatory_name: null,
      source_updated_at: null,
    },
    {
      company_name: "另一間裝修有限公司",
      phone: null,
      registration_no: "MWC 1/2020",
      expiry_date: null,
      primary_signatory_name: null,
      source_updated_at: null,
    },
  ]);

  it("matches company name substring like ilike", () => {
    const r = index.lookupWithMeta(companyNameOnlySearchInput("名富裝修"));
    expect(r.row?.registration_no).toBe("MWC 506/2014");
    expect(r.ambiguous).toBe(false);
  });

  it("flags ambiguous when two rows match", () => {
    const r = index.lookupWithMeta(companyNameOnlySearchInput("裝修"));
    expect(r.ambiguous).toBe(true);
    expect(r.row?.company_name).toBeTruthy();
  });
});
