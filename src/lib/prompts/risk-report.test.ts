import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "../constants";
import { RISK_REPORT_SYSTEM_PROMPT } from "./risk-report";

const THIRD_PARTY_PROMPT_RULE_ZH =
  "summaryZh、themes、highlights（包括 summaryZh、factSummary、sourceName）及 customClauses 不要寫出查詢對象以外任何自然人的姓名、電話、電郵、地址或身分證號碼；來源若出現則省略並只述事件。查詢對象名稱、公司名稱、政府公開名冊上的名稱及登記編號、網站或討論區名稱（sourceName 照常填寫）、法院或審裁處名稱及案件編號照常保留。";

describe("risk report system prompt", () => {
  it("adds the third-party omission rule without bumping the report version", () => {
    expect(REPORT_VERSION).toBe("2.7.0");
    expect(RISK_REPORT_SYSTEM_PROMPT).toContain(THIRD_PARTY_PROMPT_RULE_ZH);
    expect(RISK_REPORT_SYSTEM_PROMPT.split(THIRD_PARTY_PROMPT_RULE_ZH)).toHaveLength(2);
  });

  it("does not restrict names to the queried firm or forbid source and court names", () => {
    expect(RISK_REPORT_SYSTEM_PROMPT).not.toContain("只可寫查詢商號");
    expect(RISK_REPORT_SYSTEM_PROMPT).toContain("sourceName 照常填寫");
    expect(RISK_REPORT_SYSTEM_PROMPT).toContain("法院或審裁處名稱及案件編號照常保留");
    expect(RISK_REPORT_SYSTEM_PROMPT).toContain("點明與查詢對象相關的提及");
  });
});
