import { describe, expect, it } from "vitest";
import {
  allNameSearchPrefixAttempts,
  buildNameSearchPrefixes,
  splitMixedLabelParts,
  truncatePrefixSource,
} from "./prefix";

describe("buildNameSearchPrefixes (B1/M4)", () => {
  it('「SUN HUNG KAI & CO LIMITED」→ "SUN HUNG KAI"', () => {
    expect(buildNameSearchPrefixes("SUN HUNG KAI & CO LIMITED")).toEqual([
      "SUN HUNG KAI",
    ]);
  });

  it("「九龍巴士（一九三三）有限公司」→ 九龍巴士", () => {
    expect(buildNameSearchPrefixes("九龍巴士（一九三三）有限公司")).toEqual([
      "九龍巴士",
    ]);
  });

  it("mixed label: zh then en prefixes", () => {
    expect(
      buildNameSearchPrefixes("ABC裝修有限公司 ABC DECORATION LIMITED"),
    ).toEqual(["ABC裝修", "ABC DECORATION"]);
  });

  it("glued mixed label splits Han/Latin runs (c-L6)", () => {
    expect(
      buildNameSearchPrefixes("ABC裝修有限公司ABC DECORATION LIMITED"),
    ).toEqual(["ABC裝修", "ABC DECORATION"]);
  });

  it("allNameSearchPrefixAttempts includes truncated and full when both valid", () => {
    const all = allNameSearchPrefixAttempts("FOO BAR & CO LIMITED");
    expect(all[0]).toBe("FOO BAR");
    expect(all).toContain("FOO BAR & CO LIMITED");
  });

  it("truncate at opening paren", () => {
    expect(truncatePrefixSource("九龍巴士（一九三三）")).toBe("九龍巴士");
  });

  it("fullwidth Latin normalizes to ZZQ TESTING prefix (L-d)", () => {
    expect(
      buildNameSearchPrefixes("ＺＺＱ　ＴＥＳＴＩＮＧ　ＬＩＭＩＴＥＤ"),
    ).toEqual(["ZZQ TESTING"]);
  });
});

describe("splitMixedLabelParts / prefixes (B1)", () => {
  const prefixCases: [string, string[]][] = [
    ["3D裝修有限公司", ["3D裝修"]],
    ["3D裝修有限公司 3D DECORATION LIMITED", ["3D裝修", "3D DECORATION"]],
    ["合成A工程有限公司", ["合成A工程"]],
    ["裝修王A有限公司", ["裝修王A"]],
    ["ZZQ TESTING LIMITED 合成測試有限公司", ["合成測試", "ZZQ TESTING"]],
    [
      "ＺＺＱ　ＴＥＳＴＩＮＧ　ＬＩＭＩＴＥＤ 合成測試有限公司",
      ["合成測試", "ZZQ TESTING"],
    ],
    ["ZZQ TESTING LIMITED合成測試有限公司", ["合成測試"]],
    ["合成 測試有限公司 ZZQ TESTING LIMITED", ["合成 測試", "ZZQ TESTING"]],
    [
      "ABC裝修有限公司ABC DECORATION LIMITED",
      ["ABC裝修", "ABC DECORATION"],
    ],
    ["合成測試有限公司/ZZQ TESTING LIMITED", ["合成測試", "ZZQ TESTING"]],
    ["A/C工程有限公司", ["A/C工程"]],
    ["A/C工程有限公司 A/C ENGINEERING LIMITED", ["A/C工程", "A/C ENGINEERING"]],
    ["1/F裝修有限公司", ["1/F裝修"]],
    ["DECO裝修有限公司", ["DECO裝修"]],
    ["ECO環保工程有限公司", ["ECO環保工程"]],
    ["TACO工程有限公司", ["TACO工程"]],
    ["HOME DECO裝修有限公司", ["DECO裝修", "HOME"]],
  ];

  it.each(prefixCases)("%s", (label, expected) => {
    expect(buildNameSearchPrefixes(label)).toEqual(expected);
  });

  it("splits English LTD glued before Chinese company name", () => {
    expect(splitMixedLabelParts("ABC LTD合成有限公司")).toEqual({
      zh: "合成有限公司",
      en: "ABC LTD",
    });
  });

  it("paren normalization on zh segment", () => {
    expect(
      splitMixedLabelParts(
        "合成工程有限公司（香港） ZZQ ENGINEERING LIMITED (HK)",
      ).zh,
    ).toBe("合成工程有限公司(香港)");
  });

  it("halfwidth paren zh segment", () => {
    expect(
      splitMixedLabelParts(
        "合成工程(香港)有限公司 ZZQ ENGINEERING (HK) LIMITED",
      ).zh,
    ).toBe("合成工程(香港)有限公司");
  });

  it("long mixed label prefix attempts exceed fetch cap", () => {
    const label = "合成工程有限公司（香港） ZZQ ENGINEERING LIMITED (HK)";
    expect(allNameSearchPrefixAttempts(label).length).toBeGreaterThan(4);
  });

  it("avoids regex backtracking on long glued tail", () => {
    const label = "ZZQ 有限公司" + "A".repeat(20_000) + "漢 X";
    const t0 = performance.now();
    buildNameSearchPrefixes(label);
    expect(performance.now() - t0).toBeLessThan(50);
  });
});
