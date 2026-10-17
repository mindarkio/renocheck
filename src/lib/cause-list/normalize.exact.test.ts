import { describe, expect, it } from "vitest";
import {
  normalizeEnglishCompanyName,
  normalizeChineseCompanyName,
  toTraditionalHongKong,
} from "./normalize";

describe("cause-list normalize (exact)", () => {
  it("unifies Ltd and Co", () => {
    expect(normalizeEnglishCompanyName("Best Mega Engineering Co. Ltd").normStrict).toBe(
      "BEST MEGA ENGINEERING LTD",
    );
  });

  it("keeps (HK) token", () => {
    expect(
      normalizeEnglishCompanyName("Sunrise Renovation (Hong Kong) Limited").normStrict,
    ).toContain("(HK)");
  });

  it("converts simplified to traditional", () => {
    expect(toTraditionalHongKong("隆基乐叶科技有限公司")).toBe("隆基樂葉科技有限公司");
  });

  it("chinese half-width and suffix", () => {
    expect(normalizeChineseCompanyName("萬德工程有限公司").normStrict).toBe(
      "萬德工程有限公司",
    );
  });
});
