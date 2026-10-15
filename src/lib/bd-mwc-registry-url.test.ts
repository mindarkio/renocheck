import { describe, expect, it } from "vitest";
import { buildBdMwcRegistrySearchUrl } from "./bd-mwc-registry-url";

describe("buildBdMwcRegistrySearchUrl", () => {
  it("prefills registration number and MWC type for companies", () => {
    const url = buildBdMwcRegistrySearchUrl({
      registrationNo: "MWC 97/2026",
      companyName: "288 EXHIBITION PLANNING LIMITED",
    });
    expect(url).toContain("txt_reg_no=MWC+97%2F2026");
    expect(url).toContain("txt_reg_type=MWC");
    expect(url).toContain("name=");
  });

  it("uses MWC(W) register type for individual registrations", () => {
    const url = buildBdMwcRegistrySearchUrl({
      registrationNo: "MWC(W) 12/2020",
    });
    expect(url).toContain("txt_reg_type=MWC%28W%29");
  });

  it("returns null when no lookup keys", () => {
    expect(buildBdMwcRegistrySearchUrl({})).toBeNull();
  });
});
