import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "../constants";
import { RISK_REPORT_SYSTEM_PROMPT } from "./risk-report";

const THIRD_PARTY_PROMPT_RULE_ZH =
  "summaryZh、themes、highlights（包括 summaryZh、factSummary、sourceName）及 customClauses 只可寫查詢商號或政府公開名冊上的名稱；不要寫出其他自然人的姓名、電話、電郵、地址或身分證號碼，來源若出現則省略並只述事件。";

describe("risk report system prompt", () => {
  it("adds the third-party omission rule without bumping the report version", () => {
    expect(REPORT_VERSION).toBe("2.7.0");
    expect(RISK_REPORT_SYSTEM_PROMPT).toContain(THIRD_PARTY_PROMPT_RULE_ZH);
    expect(RISK_REPORT_SYSTEM_PROMPT.split(THIRD_PARTY_PROMPT_RULE_ZH)).toHaveLength(2);
  });
});
