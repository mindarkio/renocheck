import { describe, expect, it } from "vitest";
import { keyPointNumbersAppearInQuote } from "./judgment-summary-point-validation";

describe("keyPointNumbersAppearInQuote", () => {
  it("requires amounts in quote", () => {
    expect(
      keyPointNumbersAppearInQuote(
        "欠薪合共79,000元",
        "合共港幣79,000元",
      ),
    ).toBe(true);
    expect(
      keyPointNumbersAppearInQuote(
        "欠薪合共79,000元",
        "法庭駁回申索",
      ),
    ).toBe(false);
  });
});
