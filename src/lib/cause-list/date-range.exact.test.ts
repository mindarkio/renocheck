import { describe, expect, it } from "vitest";
import { isDdMmYyyyInRange } from "./date-range";

describe("isDdMmYyyyInRange", () => {
  it("compares sortable YYYYMMDD", () => {
    expect(isDdMmYyyyInRange("15082025", "01102026", "31102026")).toBe(false);
    expect(isDdMmYyyyInRange("01102026", "30092026", "02102026")).toBe(true);
  });
});
