import { describe, expect, it } from "vitest";
import { LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX } from "./legal-event-display";
import {
  summaryZhForLegalLookupDegraded,
  truncateSummaryZh,
} from "./search-pipeline-legal-summary";

describe("summaryZhForLegalLookupDegraded", () => {
  it("prefixes hint and removes 未見負面摘要 without substitution", () => {
    const out = summaryZhForLegalLookupDegraded(
      "公開討論未見負面摘要，建議自行核實。",
    );
    expect(out.startsWith(LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX)).toBe(true);
    expect(out.includes("未見負面摘要")).toBe(false);
    expect(out.includes("建議自行核實")).toBe(true);
    expect(out.endsWith("。")).toBe(true);
  });

  it("keeps 建議自行核實 intact when truncating", () => {
    const longBody = "補充說明。".repeat(35) + "建議自行核實。";
    const out = summaryZhForLegalLookupDegraded(longBody);
    const partial = out.indexOf("建議自行");
    if (partial >= 0) {
      expect(out.slice(partial)).toMatch(/^建議自行核實/);
    }
  });
});

describe("truncateSummaryZh", () => {
  it("uses code units and prefers sentence end", () => {
    const text = "第一句很長。".repeat(20) + "建議自行核實。";
    const out = truncateSummaryZh(text, 40);
    expect(Array.from(out).length).toBeLessThanOrEqual(40);
    if (out.includes("建議自行")) {
      expect(out).toContain("建議自行核實");
    }
    if (out.length > 1) {
      expect(out.endsWith("。") || !out.includes("。")).toBe(true);
    }
  });
});
