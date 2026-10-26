import { describe, expect, it } from "vitest";
import { buildSearchFingerprint } from "./search-fingerprint";

describe("buildSearchFingerprint", () => {
  it("is stable for same normalized input", () => {
    const a = buildSearchFingerprint({
      phone: "93282980",
      matchType: "phone",
    });
    const b = buildSearchFingerprint({
      phone: "93282980",
      matchType: "phone",
    });
    expect(a).toBe(b);
  });

  it("differs when the picked registration number differs", () => {
    const a = buildSearchFingerprint({
      companyName: "合成設計",
      matchType: "company_name",
      mwcRegistrationNo: "MWC 1/2026",
    });
    const b = buildSearchFingerprint({
      companyName: "合成設計",
      matchType: "company_name",
      mwcRegistrationNo: "MWC 2/2026",
    });
    expect(a).not.toBe(b);
  });

  it("differs when phone differs", () => {
    const a = buildSearchFingerprint({
      phone: "93282980",
      matchType: "phone",
    });
    const b = buildSearchFingerprint({
      phone: "93282981",
      matchType: "phone",
    });
    expect(a).not.toBe(b);
  });
});
