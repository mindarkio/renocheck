import { describe, expect, it } from "vitest";
import { buildOfficialMwcDetails } from "./mwc-official-details";
import type { MwcRow } from "./mwc-lookup";

const baseRow: MwcRow = {
  company_name: "甲公司有限公司",
  phone: null,
  registration_no: "MWC 100/2015",
  expiry_date: "2027-08-27",
  primary_signatory_name: "林云欽",
  source_updated_at: "2026-01-15T00:00:00.000Z",
};

describe("buildOfficialMwcDetails", () => {
  it("passes through company AS and expiry for corporate MWC", () => {
    const details = buildOfficialMwcDetails(baseRow);
    expect(details.companyName).toBe("甲公司有限公司");
    expect(details.authorizedSignatory).toBe("林云欽");
    expect(details.expiryDate).toBe("2027-08-27");
  });

  it("shows individual MWC(W) names as on public register", () => {
    const details = buildOfficialMwcDetails({
      ...baseRow,
      registration_no: "MWC(W) 12/2020",
      company_name: "陳大文",
      primary_signatory_name: "陳大文",
    });
    expect(details.companyName).toBe("陳大文");
    expect(details.authorizedSignatory).toBe("陳大文");
  });
});
