import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isQuoteAnalysisAvailable,
} from "@/lib/quote-analysis/config";
import {
  QUOTE_ANALYSIS_DISCLAIMER_AZURE_ZH,
  QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH,
  quoteAnalysisUserFacingCopy,
} from "@/lib/quote-analysis/copy";
import {
  REPORT_TRUST_FORBIDDEN_ZH,
  REPORT_TRUST_NEGATED_ALLOWLIST_ZH,
} from "@/lib/report-trust-copy-zh";

describe("quote analysis copy and flag", () => {
  it("stays off unless the flag and all Azure env vars are set", () => {
    expect(isQuoteAnalysisAvailable({})).toBe(false);
    expect(
      isQuoteAnalysisAvailable({
        QUOTE_ANALYSIS_ENABLED: "1",
        AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
        AZURE_OPENAI_DEPLOYMENT: "quote-gpt-6-luna",
      }),
    ).toBe(false);
    expect(
      isQuoteAnalysisAvailable({
        QUOTE_ANALYSIS_ENABLED: "1",
        AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
        AZURE_OPENAI_API_KEY: "test-not-a-key",
        AZURE_OPENAI_DEPLOYMENT: "quote-gpt-6-luna",
      }),
    ).toBe(true);
  });

  it("keeps Aaron's Azure sentence verbatim and the 180-day retention clause", () => {
    const azure =
      "Microsoft Azure 可能為偵測濫用而暫時保留提交內容及回應；微軟現行公開文件並未列明保留期限，較早版本文件曾列明最多 30 日。本服務亦會保留分析頁數、用量及費用紀錄、所用模型及時間。上述分析結果及紀錄會於 180 日後或閣下刪除帳戶時（以較早者為準）刪除。登入後，本網站會以 cookie 保存閣下的登入狀態。";
    expect(QUOTE_ANALYSIS_DISCLAIMER_AZURE_ZH).toBe(azure);
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).toContain(azure);
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).toContain(
      "直至 180 日屆滿或閣下刪除帳戶（以較早者為準）。",
    );
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).toContain(
      "分析完成後，本服務保留與該帳戶相連的結構化分析結果（各檢查項目的狀態），直至 180 日屆滿或閣下刪除帳戶（以較早者為準）。",
    );
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).not.toContain("本服務只保留");
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).toContain("只限 PDF");
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).not.toContain("直至閣下刪除帳戶");
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).toContain(
      "如報價單上載分析未開放，閣下可電郵至 hello@renocheck.homes 要求刪除帳戶。",
    );
    // DEC-0016: the resource region is Aaron-approved copy; a revert to Japan East must fail here.
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).toContain(
      "（資源位於南韓中部；個別請求可能在該模型可供使用的任何 Azure 地區處理）",
    );
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).toContain(
      "報價單所載的承辦公司或商號名稱會被抽出，並與結構化分析結果一併保存",
    );
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).not.toContain("本服務不會保留該名稱");
    expect(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH).not.toContain("日本");
  });

  it("keeps new copy clear of report-trust forbidden words", () => {
    for (const text of quoteAnalysisUserFacingCopy()) {
      let remaining = text;
      for (const ok of REPORT_TRUST_NEGATED_ALLOWLIST_ZH) {
        remaining = remaining.split(ok).join("");
      }
      for (const word of REPORT_TRUST_FORBIDDEN_ZH) {
        expect(remaining).not.toContain(word);
      }
    }
  });

  it("does not let quote analysis share the company-report model", () => {
    const llm = readFileSync("src/lib/llm-model.ts", "utf8");
    const provider = readFileSync("src/lib/quote-analysis/provider.ts", "utf8");
    expect(llm).not.toContain("@ai-sdk/azure");
    expect(llm).not.toContain("AZURE_OPENAI");
    expect(provider).not.toContain("llm-model");
    expect(provider).not.toContain("@ai-sdk/google");
    expect(provider).not.toContain("@ai-sdk/gateway");
    expect(provider).not.toContain("@ai-sdk/openai");
  });
});
