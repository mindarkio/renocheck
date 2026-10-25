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

  it("matches an English name and a 恒/恆 variant", () => {
    const bilingual = new MwcContractorsMemoryIndex([
      {
        company_name: "恆偉工程公司",
        company_name_en: "HANG WAI ENGINEERING LIMITED",
        phone: null,
        registration_no: "MWC-00001",
        expiry_date: null,
        primary_signatory_name: null,
        source_updated_at: null,
      },
    ]);
    expect(
      bilingual.lookupWithMeta(companyNameOnlySearchInput("恒偉工程公司")).row
        ?.registration_no,
    ).toBe("MWC-00001");
    expect(
      bilingual.lookupWithMeta(
        companyNameOnlySearchInput("HANG WAI ENGINEERING LIMITED"),
      ).row?.company_name,
    ).toBe("恆偉工程公司");
  });

  it("flags ambiguous when two rows match", () => {
    const r = index.lookupWithMeta(companyNameOnlySearchInput("裝修"));
    expect(r.ambiguous).toBe(true);
    expect(r.row?.company_name).toBeTruthy();
  });

  it("ranks exact over prefix over a contains match", () => {
    const ranked = new MwcContractorsMemoryIndex([
      {
        company_name: "某某齊來設計顧問有限公司",
        phone: null,
        registration_no: "MWC-CONTAINS",
        expiry_date: null,
        primary_signatory_name: null,
        source_updated_at: null,
      },
      {
        company_name: "齊來設計居+屋及擴建工程有限公司",
        phone: null,
        registration_no: "MWC-PREFIX",
        expiry_date: null,
        primary_signatory_name: null,
        source_updated_at: null,
      },
      {
        company_name: "齊來設計",
        phone: null,
        registration_no: "MWC-EXACT",
        expiry_date: null,
        primary_signatory_name: null,
        source_updated_at: null,
      },
    ]);
    const found = ranked.lookupWithMeta(companyNameOnlySearchInput("齊來設計"));
    expect(found.row?.registration_no).toBe("MWC-EXACT");
    expect(found.ambiguous).toBe(true);
  });

  it("matches an English register name case-insensitively", () => {
    const idx = new MwcContractorsMemoryIndex([
      {
        company_name: "合成恆偉工程有限公司",
        company_name_en: "HANG WAI ENGINEERING LIMITED",
        phone: null,
        registration_no: "MWC-EN",
        expiry_date: null,
        primary_signatory_name: null,
        source_updated_at: null,
      },
    ]);
    const found = idx.lookupWithMeta(companyNameOnlySearchInput("hang wai engineering"));
    expect(found.row?.registration_no).toBe("MWC-EN");
    expect(found.ambiguous).toBe(false);
  });
});
