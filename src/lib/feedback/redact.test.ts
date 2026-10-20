import { describe, expect, it } from "vitest";
import { redactFeedbackComment, stripControlAndBidi } from "./redact";

describe("feedback comment redaction", () => {
  it("strips C0/C1 control characters and bidi marks", () => {
    expect(stripControlAndBidi("a\u0001b\u007Fc\u0080d\u202Ee\u200Bf")).toBe(
      "abcdef",
    );
  });

  it("redacts phones, emails, HKID-like tokens, and honorific names", () => {
    const raw =
      "聯絡 9123 4567 / +852 61234567 同 a.b@example.com，證 A123456(7) 陳生 李小姐 wa.me/85290000000";
    const out = redactFeedbackComment(raw);
    expect(out).not.toContain("9123");
    expect(out).not.toContain("61234567");
    expect(out).not.toContain("example.com");
    expect(out).not.toContain("A123456");
    expect(out).not.toContain("陳生");
    expect(out).not.toContain("李小姐");
    expect(out).not.toContain("wa.me");
    expect(out).toContain("[電話]");
    expect(out).toContain("[電郵]");
    expect(out).toContain("[身份證]");
    expect(out).toContain("[姓名]");
  });

  it("keeps an ordinary company mention", () => {
    expect(redactFeedbackComment("合成測試有限公司")).toBe("合成測試有限公司");
  });
});
