import { describe, expect, it } from "vitest";
import { LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX } from "./legal-event-display";
import { summaryZhForLegalLookupDegraded } from "./search-pipeline-legal-summary";

describe("summaryZhForLegalLookupDegraded", () => {
  it("prefixes hint and replaces 未見負面摘要", () => {
    const out = summaryZhForLegalLookupDegraded(
      "公開討論未見負面摘要，建議自行核實。",
    );
    expect(out.startsWith(LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX)).toBe(true);
    expect(out.includes("未見負面摘要")).toBe(false);
    expect(out.includes("中性")).toBe(true);
  });
});
