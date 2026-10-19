import { describe, expect, it } from "vitest";
import {
  buildDailyCauseListPostFields,
  buildJudiciaryDeepLinks,
  hktDateDdmmyyyy,
} from "./judiciary-search-deep-links";

describe("judiciary-search-deep-links", () => {
  it("buildJudiciaryDeepLinks uses www.hklii.hk", () => {
    const label = "合成測試有限公司";
    const url = buildJudiciaryDeepLinks(label).hkliiSearch;
    expect(url).toBe(
      `https://www.hklii.hk/search?q=${encodeURIComponent(label)}`,
    );
    expect(url).not.toContain("v2.");
  });

  it("hktDateDdmmyyyy uses Asia/Hong_Kong calendar date", () => {
    expect(hktDateDdmmyyyy(new Date("2026-10-19T16:30:00Z"))).toBe("20102026");
    expect(hktDateDdmmyyyy(new Date("2026-10-19T15:59:00Z"))).toBe("19102026");
  });

  it("buildDailyCauseListPostFields trims and caps parties", () => {
    const d = new Date("2026-10-19T15:59:00Z");
    expect(buildDailyCauseListPostFields("  合成測試有限公司 ", d)).toEqual({
      lang: "tc",
      date: "19102026",
      mode: "search",
      parties: "合成測試有限公司",
    });
  });
});
