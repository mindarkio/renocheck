import { describe, expect, it } from "vitest";
import {
  isCorporateEntityName,
  parseCorporateParties,
  splitPartyBlock,
} from "./party";

describe("cause-list party splitter (exact)", () => {
  it("splits t/a trading as", () => {
    const parties = splitPartyBlock(
      "D1 : SUNRISE RENOVATION (HK) LIMITED t/a 旭日裝飾工程",
      "defendant",
    );
    const corps = parseCorporateParties(parties);
    expect(corps).toHaveLength(1);
    expect(corps[0].legalName).toContain("SUNRISE RENOVATION");
    expect(corps[0].tradeName).toContain("旭日裝飾");
  });

  it("splits 所經營", () => {
    const parties = splitPartyBlock(
      "R1: 示例有限公司所經營 U N ME STUDIO",
      "respondent",
    );
    const corps = parseCorporateParties(parties);
    expect(corps).toHaveLength(1);
    expect(corps[0].tradeName).toBe("U N ME STUDIO");
  });

  it("marks incorporated owners", () => {
    const parties = splitPartyBlock("R1: 橡樹苑業主立案法團", "respondent");
    const corps = parseCorporateParties(parties);
    expect(corps[0].incorporatedOwners).toBe(true);
  });

  it("drops person without logging", () => {
    expect(isCorporateEntityName("FAKE PERSON ALPHA")).toBe(false);
    const corps = parseCorporateParties([
      { role: "defendant", rawName: "FAKE PERSON ALPHA" },
    ]);
    expect(corps).toHaveLength(0);
  });
});
