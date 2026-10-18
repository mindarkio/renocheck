import { describe, expect, it } from "vitest";
import { isCrOpenDataBrnEqualValue } from "./brn";

describe("isCrOpenDataBrnEqualValue", () => {
  it("accepts C + 7 digits", () => {
    expect(isCrOpenDataBrnEqualValue("C1566911")).toBe(true);
  });
  it("rejects 8-digit tax-style only", () => {
    expect(isCrOpenDataBrnEqualValue("12345678")).toBe(false);
    expect(isCrOpenDataBrnEqualValue("81390375")).toBe(false);
  });
});
