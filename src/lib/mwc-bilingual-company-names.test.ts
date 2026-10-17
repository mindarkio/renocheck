import { describe, expect, it } from "vitest";
import { extractMwcBilingualNames } from "./mwc-bilingual-company-names";

describe("extractMwcBilingualNames", () => {
  it("splits Chinese (English)", () => {
    const n = extractMwcBilingualNames(
      "示例裝修工程有限公司 (SAMPLE DECORATION LTD)",
    );
    expect(n.zh).toContain("示例");
    expect(n.en).toMatch(/SAMPLE/i);
  });

  it("keeps Chinese-only", () => {
    const n = extractMwcBilingualNames("名富裝修工程有限公司");
    expect(n.zh).toBe("名富裝修工程有限公司");
    expect(n.en).toBeNull();
  });
});
