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

  it("does not let a typed |r: suffix collide with a register pick", () => {
    const picked = buildSearchFingerprint({
      companyName: "合成設計",
      matchType: "company_name",
      mwcRegistrationNo: "MWC 1/2026",
    });
    const typed = buildSearchFingerprint({
      companyName: "合成設計|r:mwc 1/2026",
      matchType: "company_name",
    });
    expect(typed).not.toBe(picked);
  });

  it("keeps fingerprints without a pick unchanged", () => {
    // sha256("c:合成設計").slice(0, 32): cached reports stay reachable.
    expect(buildSearchFingerprint({ companyName: "合成設計", matchType: "company_name" })).toBe(
      "a31aceed631c030ee61e5b27b1d31c79",
    );
  });
});
