import { describe, expect, it } from "vitest";
import {
  formatMwcExpiryDateZh,
  isMwcExpiryBeforeReport,
  parseBdRegistryExpiryDate,
} from "./mwc-registry-display";

describe("mwc-registry-display", () => {
  it("parses BD DD/MM/YYYY expiry", () => {
    expect(parseBdRegistryExpiryDate("21/01/2029")).toBe("2029-01-21");
    expect(parseBdRegistryExpiryDate("")).toBeNull();
  });

  it("formats expiry for HK copy", () => {
    expect(formatMwcExpiryDateZh("2029-01-21")).toBe("2029年1月21日");
  });

  it("detects expiry before report time", () => {
    expect(
      isMwcExpiryBeforeReport("2020-01-01", "2026-01-15T00:00:00.000Z"),
    ).toBe(true);
    expect(
      isMwcExpiryBeforeReport("2030-01-01", "2026-01-15T00:00:00.000Z"),
    ).toBe(false);
  });
});
