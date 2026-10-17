import { describe, expect, it } from "vitest";
import {
  normalizeEnglishCompanyName,
  normalizeChineseCompanyName,
  toTraditionalHongKong,
  cjkEditDistance,
  splitBilingualCompanyRaw,
} from "./normalize";

describe("cause-list normalize (exact)", () => {
  it("unifies Ltd and Co", () => {
    expect(
      normalizeEnglishCompanyName("Fictive Mega Engineering Co. Ltd").normStrict,
    ).toBe("FICTIVE MEGA ENGINEERING LTD");
  });

  it("keeps (HK) token", () => {
    expect(
      normalizeEnglishCompanyName("Fictive Renovation (Hong Kong) Limited").normStrict,
    ).toContain("(HK)");
  });

  it("converts simplified to traditional via opencc", () => {
    expect(toTraditionalHongKong("示例光伏科技有限公司")).toBe("示例光伏科技有限公司");
    expect(toTraditionalHongKong("隆基乐叶科技有限公司")).toBe("隆基樂葉科技有限公司");
    expect(toTraditionalHongKong("中国华业")).toBe("中國華業");
  });

  it("chinese half-width and suffix", () => {
    expect(normalizeChineseCompanyName("示例工程有限公司").normStrict).toBe(
      "示例工程有限公司",
    );
  });

  it("regional zh core strips （香港）", () => {
    expect(
      normalizeChineseCompanyName("示例工程（香港）有限公司").normCore,
    ).toBe("示例工程");
  });

  it("bilingual without brackets", () => {
    const bi = splitBilingualCompanyRaw(
      "FICTIVE MEGA ENGINEERING CO., LTD. 示例工程有限公司",
    );
    expect(bi.en).toContain("FICTIVE MEGA");
    expect(bi.zh).toContain("示例工程");
  });

  it("cjk edit distance uses code points", () => {
    expect(cjkEditDistance("𠀋A", "𠀋B")).toBe(1);
  });
});
