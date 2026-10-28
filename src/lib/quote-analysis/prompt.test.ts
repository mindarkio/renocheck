import { describe, expect, it } from "vitest";
import {
  QUOTE_ANALYSIS_USER_TEXT,
  QUOTE_EXTRACT_SYSTEM_PROMPT,
  QUOTE_EXTRACT_USER_TEXT,
  quoteAnalysisSystemPrompt,
} from "@/lib/quote-analysis/prompt";

const PERSONAL = ["個人姓名", "電話", "地址", "簽名", "銀行戶口"] as const;

describe("quote analysis prompt", () => {
  it("allows only the contracting company name and still forbids personal data", () => {
    const system = quoteAnalysisSystemPrompt({});
    const combined = `${system}\n${QUOTE_ANALYSIS_USER_TEXT}\n${QUOTE_EXTRACT_SYSTEM_PROMPT}\n${QUOTE_EXTRACT_USER_TEXT}`;
    for (const word of PERSONAL) {
      expect(combined).toContain(word);
    }
    expect(system).toContain("承辦公司或商號");
    expect(system).toContain("companyName");
    expect(QUOTE_ANALYSIS_USER_TEXT).toContain("承辦公司或商號名稱");
    expect(combined).not.toContain("唔好輸出姓名、電話");
    expect(combined).not.toContain("唔好抄姓名、電話");
  });
});
