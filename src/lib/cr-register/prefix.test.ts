import { describe, expect, it } from "vitest";
import {
  allNameSearchPrefixAttempts,
  buildNameSearchPrefixes,
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
