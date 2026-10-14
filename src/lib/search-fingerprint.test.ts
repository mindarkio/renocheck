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
