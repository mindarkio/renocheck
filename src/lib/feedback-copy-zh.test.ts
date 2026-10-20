import { describe, expect, it } from "vitest";
import { REPORT_TRUST_FORBIDDEN_ZH } from "./report-trust-copy-zh";
import {
  FEEDBACK_CHANGE_ZH,
  FEEDBACK_CLOSE_LABEL_ZH,
  FEEDBACK_COMPANY_HEADING_ZH,
  FEEDBACK_ERROR_ZH,
  FEEDBACK_DISMISS_ZH,
  FEEDBACK_DOWN_ZH,
  FEEDBACK_PLACEHOLDER_ZH,
  FEEDBACK_QUOTE_HEADING_ZH,
  FEEDBACK_REGION_LABEL_ZH,
  FEEDBACK_SUBMIT_ZH,
  FEEDBACK_THANKS_ZH,
  FEEDBACK_UP_ZH,
} from "./feedback-copy-zh";

describe("feedback copy", () => {
  it("uses the approved strings and keeps the quote heading unrendered by this module's company string", () => {
    expect(FEEDBACK_COMPANY_HEADING_ZH).toBe("呢份報告有冇幫到你？");
    expect(FEEDBACK_QUOTE_HEADING_ZH).toBe("呢份分析有冇幫到你？");
    expect(FEEDBACK_UP_ZH).toBe("👍 有幫助");
    expect(FEEDBACK_DOWN_ZH).toBe("👎 冇幫助");
    expect(FEEDBACK_PLACEHOLDER_ZH).toBe("想補充啲咩？（可選，唔好填姓名或電話）");
    expect(FEEDBACK_SUBMIT_ZH).toBe("送出");
    expect(FEEDBACK_THANKS_ZH).toBe("多謝你嘅意見！");
    expect(FEEDBACK_DISMISS_ZH).toBe("唔使喇");
    expect(FEEDBACK_REGION_LABEL_ZH).toBe("意見回饋");
    expect(FEEDBACK_CLOSE_LABEL_ZH).toBe("關閉");
    expect(FEEDBACK_ERROR_ZH).toBe("暫時送唔到，請稍後再試。");
    expect(FEEDBACK_CHANGE_ZH).toBe("改評分");
    expect(FEEDBACK_PLACEHOLDER_ZH).toContain("唔好填姓名或電話");
    expect(FEEDBACK_COMPANY_HEADING_ZH).not.toBe(FEEDBACK_QUOTE_HEADING_ZH);
  });

  it("passes REPORT_TRUST_FORBIDDEN_ZH", () => {
    const text = [
      FEEDBACK_COMPANY_HEADING_ZH,
      FEEDBACK_QUOTE_HEADING_ZH,
      FEEDBACK_UP_ZH,
      FEEDBACK_DOWN_ZH,
      FEEDBACK_PLACEHOLDER_ZH,
      FEEDBACK_SUBMIT_ZH,
      FEEDBACK_THANKS_ZH,
      FEEDBACK_DISMISS_ZH,
      FEEDBACK_REGION_LABEL_ZH,
      FEEDBACK_CLOSE_LABEL_ZH,
      FEEDBACK_ERROR_ZH,
      FEEDBACK_CHANGE_ZH,
    ].join("\n");
    for (const word of REPORT_TRUST_FORBIDDEN_ZH) {
      expect(text).not.toContain(word);
    }
  });
});
