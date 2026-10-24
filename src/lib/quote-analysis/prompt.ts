import { QUOTE_CHECK_ITEMS } from "@/lib/quote-selfcheck";
import { activeQuoteCheckIds } from "@/lib/quote-analysis/schema";

const ARITHMETIC_LINE =
  "- arithmetic｜加總唔一致｜clear = 行數加總對得上；vague 或 missing = 加總對唔齊。呢項唔係評價價錢是否合理。";

export function quoteAnalysisSystemPrompt(
  env: Record<string, string | undefined> = process.env,
): string {
  const ids = new Set(activeQuoteCheckIds(env));
  const lines = QUOTE_CHECK_ITEMS.filter((item) => ids.has(item.id)).map(
    (item) =>
      `- ${item.id}｜${item.label}｜clear：${item.clearExample}｜vague：${item.vagueExample}`,
  );
  if (ids.has("arithmetic")) lines.push(ARITHMETIC_LINE);

  return [
    "你是報價單檢查工具。只根據 PDF 判斷清單上每一項的 status。",
    "status 只可以是 clear、vague、missing、na。",
    "唔好評價價錢是否合理，唔好評價公司，唔好輸出姓名、電話、地址、簽名或銀行戶口。",
    "唔好加清單以外的 id。每個 id 最多一次。",
    "如果檔案唔係裝修報價單，isQuotation 設為 false，items 可以是空陣列。",
    "清單：",
    ...lines,
  ].join("\n");
}
