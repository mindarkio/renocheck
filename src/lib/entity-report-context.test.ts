import { describe, expect, it } from "vitest";
import {
  computeNameAlignment,
  normalizeCompanyNameForCompare,
  resolveAuthoritativeSearchLabel,
} from "./entity-report-context";

describe("resolveAuthoritativeSearchLabel", () => {
  it("uses MWC name when provided", () => {
    expect(
      resolveAuthoritativeSearchLabel(
        { companyName: "用戶名" },
        { mwcCompanyName: "名冊登記名有限公司" },
      ),
    ).toBe("名冊登記名有限公司");
  });
});

describe("computeNameAlignment", () => {
  const mwc = {
    company_name: "甲公司有限公司",
    phone: null,
    registration_no: "MWC123",
  };

  it("returns ambiguous when flagged", () => {
    expect(
      computeNameAlignment(
        { companyName: "甲", matchType: "company_name" },
        mwc,
        true,
      ),
    ).toBe("ambiguous");
  });

  it("returns mwc_authoritative when names differ", () => {
    expect(
      computeNameAlignment(
        { companyName: "乙公司", matchType: "company_name" },
        mwc,
        false,
      ),
    ).toBe("mwc_authoritative");
  });

  it("returns match when normalized names equal", () => {
    expect(
      computeNameAlignment(
        { companyName: "甲公司有限公司", matchType: "company_name" },
        mwc,
        false,
      ),
    ).toBe("match");
  });
});

describe("normalizeCompanyNameForCompare", () => {
  it("normalizes full-width brackets", () => {
    expect(normalizeCompanyNameForCompare("源始（國際）")).toBe(
      normalizeCompanyNameForCompare("源始(國際)"),
    );
  });
});
