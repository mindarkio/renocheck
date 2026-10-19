import { describe, expect, it } from "vitest";
import {
  buildDailyCauseListPostFields,
  buildJudiciaryDeepLinks,
  dailyCauseListPartyQuery,
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

  it("dailyCauseListPartyQuery: digits → null; bilingual → one part", () => {
    expect(dailyCauseListPartyQuery("91234567")).toBeNull();
    expect(dailyCauseListPartyQuery(" 12345678 ")).toBeNull();
    expect(dailyCauseListPartyQuery("合成測試有限公司")).toBe("合成測試有限公司");
    const q = dailyCauseListPartyQuery("合成測試有限公司 ZZQ TESTING LIMITED");
    expect(q).toBe("合成測試有限公司");
    expect(dailyCauseListPartyQuery("ZZQ TESTING LIMITED")).toBe("ZZQ TESTING LIMITED");
  });

  it("buildDailyCauseListPostFields does not split a surrogate pair", () => {
    const d = new Date("2026-10-19T15:59:00Z");
    const label = "合".repeat(199) + "𠀋𠀋";
    expect(buildDailyCauseListPostFields(label, d).parties).toBe("合".repeat(199) + "𠀋");
  });

  it("dailyCauseListPartyQuery: bracketed zh part and full-width English", () => {
    expect(dailyCauseListPartyQuery("ZZQ TESTING LIMITED (合成測試有限公司)")).toBe("合成測試有限公司");
    expect(dailyCauseListPartyQuery("ZZQ TESTING LIMITED（合成測試有限公司）")).toBe("合成測試有限公司");
    expect(dailyCauseListPartyQuery("合成測試(香港)有限公司 ZZQ TESTING (HK) LIMITED")).toBe("合成測試(香港)有限公司");
    expect(dailyCauseListPartyQuery("ＺＺＱ ＴＥＳＴＩＮＧ ＬＩＭＩＴＥＤ")).toBe("ZZQ TESTING LIMITED");
    for (const label of [
      "ZZQ TESTING LIMITED(合成測試有限公司)",
      "ZZQ TESTING LIMITED （合成測試有限公司）",
      "(合成測試有限公司) ZZQ TESTING LIMITED",
      "ZZQ TESTING LIMITED/合成測試有限公司",
      "ZZQ TESTING LIMITED 【合成測試有限公司】",
      "ZZQ TESTING LIMITED「合成測試有限公司」",
    ]) {
      expect(dailyCauseListPartyQuery(label)).toBe("合成測試有限公司");
    }
    expect(
      dailyCauseListPartyQuery("ZZQ TESTING (HK) LIMITED（合成測試（香港）有限公司）"),
    ).toBe("合成測試(香港)有限公司");
    expect(dailyCauseListPartyQuery("3D合成測試有限公司 3D ZZQ LIMITED")).toBe("3D合成測試有限公司");
    expect(dailyCauseListPartyQuery("ABC合成測試有限公司")).toBe("ABC合成測試有限公司");
    expect(dailyCauseListPartyQuery("3D(香港)合成測試有限公司 ZZQ LIMITED")).toBe("3D(香港)合成測試有限公司");
  });
});
