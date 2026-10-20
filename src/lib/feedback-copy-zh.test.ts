import { describe, expect, it } from "vitest";
import {
  REPORT_TRUST_FORBIDDEN_ZH,
  REPORT_TRUST_NEGATED_ALLOWLIST_ZH,
} from "./report-trust-copy-zh";
import {
  FEEDBACK_CHANGE_ZH,
  FEEDBACK_CLOSE_LABEL_ZH,
  FEEDBACK_COMMENT_LABEL_ZH,
  FEEDBACK_COMPANY_HEADING_ZH,
  FEEDBACK_ERROR_ZH,
  FEEDBACK_DISMISS_ZH,
  FEEDBACK_DOWN_ZH,
  FEEDBACK_PLACEHOLDER_ZH,
  FEEDBACK_PRIVACY_HREF,
  FEEDBACK_PRIVACY_LINK_ZH,
  FEEDBACK_PRIVACY_NOTICE_ZH,
  FEEDBACK_QUOTE_HEADING_ZH,
  FEEDBACK_REGION_LABEL_ZH,
  FEEDBACK_SUBMIT_ZH,
  FEEDBACK_THANKS_ZH,
  FEEDBACK_UP_ZH,
} from "./feedback-copy-zh";

const BANNED = [
  "刊憲",
  "數日",
  "小型申索",
  "觸犯",
  "LRS",
  "傢俬",
  "授權前",
  "匿名條數",
] as const;

function assertClean(text: string): void {
  let t = text;
  for (const ok of REPORT_TRUST_NEGATED_ALLOWLIST_ZH) {
    t = t.split(ok).join("");
  }
  for (const word of REPORT_TRUST_FORBIDDEN_ZH) {
    expect(t).not.toContain(word);
  }
  for (const word of BANNED) {
    expect(t).not.toContain(word);
  }
}

describe("feedback copy", () => {
  it("uses the approved strings and keeps the quote heading unrendered by this module's company string", () => {
    expect(FEEDBACK_COMPANY_HEADING_ZH).toBe("呢份報告有冇幫到你？");
    expect(FEEDBACK_QUOTE_HEADING_ZH).toBe("呢份分析有冇幫到你？");
    expect(FEEDBACK_UP_ZH).toBe("👍 有幫助");
    expect(FEEDBACK_DOWN_ZH).toBe("👎 冇幫助");
    expect(FEEDBACK_PLACEHOLDER_ZH).toBe("想補充啲咩？（可選，唔好填姓名或電話）");
    expect(FEEDBACK_COMMENT_LABEL_ZH).toBe("你覺得 RenoCheck 點樣可以做得更好？");
    expect(FEEDBACK_PRIVACY_LINK_ZH).toBe("個人資料（私隱）");
    expect(FEEDBACK_PRIVACY_HREF).toBe("/legal/disclaimer#feedback-privacy");
    expect(FEEDBACK_PRIVACY_NOTICE_ZH).toBe(
      "閣下於報告頁提交的評分（👍/👎）及文字意見，僅用於了解及改善 RenoCheck 的服務，不會公開顯示。我們不需要閣下的姓名、電話號碼或其他個人資料，請勿於意見中填寫；如有填寫，系統將自動遮蓋。為防止重複評分，我們會儲存一個經雜湊處理的裝置識別碼。上述資料由 MindArk IO Ltd（於英國註冊的公司，以 RenoCheck 名義營運，註冊地址：Office 18282, 182-184 High Street North, East Ham, London, E6 2JA, United Kingdom）基於合法權益處理，並於 12 個月後自動刪除。如有查詢，或欲查閱、更正或刪除有關資料，請電郵至 hello@renocheck.homes。閣下亦可向英國資訊專員辦公室（ICO）或香港個人資料私隱專員公署作出投訴。",
    );
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
      FEEDBACK_COMMENT_LABEL_ZH,
      FEEDBACK_PRIVACY_LINK_ZH,
      FEEDBACK_PRIVACY_NOTICE_ZH,
    ].join("\n");
    assertClean(text);
  });
});
