import { describe, expect, it } from "vitest";
import { verificationScopeLine } from "./verification-scope-line";

describe("verificationScopeLine", () => {
  it("hides the line when there is no register row", () => {
    expect(
      verificationScopeLine({
        typed: "合成設計",
        registerName: "合成設計有限公司",
        mwcMatched: false,
      }),
    ).toBeNull();
  });

  it("hides the line when the typed text and the register name match", () => {
    expect(
      verificationScopeLine({
        typed: "合成設計有限公司",
        registerName: "合成設計有限公司",
        mwcMatched: true,
      }),
    ).toBeNull();
  });

  it("ignores spaces and full-width characters", () => {
    expect(
      verificationScopeLine({
        typed: "合成　設計 有限公司",
        registerName: "合成設計有限公司",
        mwcMatched: true,
      }),
    ).toBeNull();
    expect(
      verificationScopeLine({
        typed: "ＡＢＣ工程有限公司",
        registerName: "ABC工程有限公司",
        mwcMatched: true,
      }),
    ).toBeNull();
    expect(
      verificationScopeLine({
        typed: "abc engineering limited",
        registerName: "ABC Engineering Limited",
        mwcMatched: true,
      }),
    ).toBeNull();
  });

  it("shows the slash line when a company name search differs from the register", () => {
    expect(
      verificationScopeLine({
        typed: "合成設計",
        registerName: "合成設計有限公司",
        mwcMatched: true,
      }),
    ).toEqual({
      heading: "本次查證範圍",
      line: "你輸入「合成設計」／名冊名稱「合成設計有限公司」",
    });
  });

  it("uses two sentences when a name contains a slash", () => {
    expect(
      verificationScopeLine({
        typed: "合成／設計",
        registerName: "合成設計有限公司",
        mwcMatched: true,
      })?.line,
    ).toBe("你輸入「合成／設計」。報告用名冊名稱「合成設計有限公司」。");
    expect(
      verificationScopeLine({
        typed: "A/B Works",
        registerName: "AB Works Limited",
        mwcMatched: true,
      })?.line,
    ).toBe("你輸入「A/B Works」。報告用名冊名稱「AB Works Limited」。");
  });

  it("shows the line for a phone or BR search whose heading is the register name", () => {
    expect(
      verificationScopeLine({
        typed: "91234567",
        registerName: "合成設計有限公司",
        mwcMatched: true,
      })?.line,
    ).toBe("你輸入「91234567」／名冊名稱「合成設計有限公司」");
    expect(
      verificationScopeLine({
        typed: "12345678",
        registerName: "合成設計有限公司",
        mwcMatched: true,
      })?.line,
    ).toBe("你輸入「12345678」／名冊名稱「合成設計有限公司」");
  });
});
