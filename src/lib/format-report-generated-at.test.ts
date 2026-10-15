import { describe, expect, it } from "vitest";
import { formatReportGeneratedAtHkt } from "./format-report-generated-at";

describe("formatReportGeneratedAtHkt", () => {
  it("formats ISO instant as Hong Kong time (UTC+8)", () => {
    expect(formatReportGeneratedAtHkt("2026-10-15T13:53:22.128Z")).toBe(
      "2026-10-15 21:53 (HKT)",
    );
  });
});
