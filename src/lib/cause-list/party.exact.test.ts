import { describe, expect, it } from "vitest";
import { parseAndSplitPartyCell } from "./parse-parties";
import {
  isCorporateEntityName,
  parseCorporateParties,
  splitPartyBlock,
} from "./party";

describe("cause-list party splitter (exact)", () => {
  it("splits t/a trading as on corporate legal name", () => {
    const parties = splitPartyBlock(
      "D1 : FICTIVE RENOVATION (HK) LIMITED t/a 示例裝飾工程",
      "defendant",
    );
    const corps = parseCorporateParties(parties);
    expect(corps).toHaveLength(1);
    expect(corps[0].legalName).toContain("FICTIVE RENOVATION");
    expect(corps[0].tradeName).toContain("示例裝飾");
  });

  it("drops non-limited t/a operator", () => {
    const parties = splitPartyBlock(
      "FAKE PERSON t/a FICTIVE MEGA ENGINEERING LIMITED",
      "defendant",
    );
    expect(parseCorporateParties(parties)).toHaveLength(0);
  });

  it("does not split inline AND in company name", () => {
    const parties = splitPartyBlock("D1: ALPHA AND BETA LIMITED", "defendant", {
      splitInlineAnd: false,
    });
    const corps = parseCorporateParties(parties);
    expect(corps).toHaveLength(1);
    expect(corps[0].legalName).toBe("ALPHA AND BETA LIMITED");
  });

  it("CACFI And-split", () => {
    const parties = parseAndSplitPartyCell(
      "SYNTH A LIMITED\nAnd\nSYNTH B LIMITED",
    );
    expect(parties.map((p) => p.role)).toEqual(["plaintiff", "defendant"]);
  });

  it("drops incorporated owners", () => {
    const parties = splitPartyBlock("R1: 示例苑業主立案法團", "respondent");
    expect(parseCorporateParties(parties)).toHaveLength(0);
    expect(isCorporateEntityName("示例苑業主立案法團")).toBe(false);
  });

  it("corporate markers (M1)", () => {
    expect(isCorporateEntityName("XYZ INC")).toBe(false);
    expect(isCorporateEntityName("XYZ CORPORATION")).toBe(false);
    expect(isCorporateEntityName("ABC LIMITED PARTNERSHIP")).toBe(false);
    expect(isCorporateEntityName("Limited Edition Studio")).toBe(false);
    expect(isCorporateEntityName("甲乙有限責任公司")).toBe(true);
    expect(isCorporateEntityName("ABC (HK) LIMITED")).toBe(true);
  });

  it("drops person without logging", () => {
    expect(isCorporateEntityName("FAKE PERSON ALPHA")).toBe(false);
    const corps = parseCorporateParties([
      { role: "defendant", rawName: "FAKE PERSON ALPHA" },
    ]);
    expect(corps).toHaveLength(0);
  });
});
