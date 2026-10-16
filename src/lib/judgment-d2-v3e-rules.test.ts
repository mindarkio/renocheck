import { describe, expect, it } from "vitest";
import {
  isV3eAutoDropCasePrefix,
  soleProprietorTradeHasKeepKeyword,
} from "./judgment-d2-v3e-rules";

describe("judgment-d2-v3e-rules", () => {
  it("drops HCPI / LDPE prefixes", () => {
    expect(isV3eAutoDropCasePrefix("HCPI 1/2020")).toBe(true);
    expect(isV3eAutoDropCasePrefix("LDPE 1/2020")).toBe(true);
    expect(isV3eAutoDropCasePrefix("DCCJ 1/2020")).toBe(false);
  });

  it("sole prop trade keyword from 經營商號", () => {
    expect(
      soleProprietorTradeHasKeepKeyword("陳國新經營燊記裝修水電工程"),
    ).toBe(true);
    expect(soleProprietorTradeHasKeepKeyword("李四經營天天書店")).toBe(false);
  });
});
