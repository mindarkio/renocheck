import { describe, expect, it } from "vitest";
import {
  isIncorporationUnderOneYearAt,
  parseCrIncorporationDateToIso,
} from "./parse-date";

describe("parseCrIncorporationDateToIso", () => {
  it("parses DD-MM-YYYY", () => {
    expect(parseCrIncorporationDateToIso("15-10-2024")).toBe("2024-10-15");
  });
});

describe("isIncorporationUnderOneYearAt", () => {
  it("uses retrievedAt not wall clock", () => {
    expect(
      isIncorporationUnderOneYearAt("2024-06-01", "2024-12-01T00:00:00.000Z"),
    ).toBe(true);
    expect(
      isIncorporationUnderOneYearAt("2020-01-01", "2024-12-01T00:00:00.000Z"),
    ).toBe(false);
  });
});
