import { generateObject } from "ai";
import { z } from "zod";
import { outcomeHintSchema } from "./outcome-hint";
import {
  keyPointNumbersAppearInQuote,
  sanitizeSummaryPoint,
} from "./judgment-summary-point-validation";
import { isLlmConfigured, resolveRiskReportModel } from "./llm-model";

const pointSchema = z.object({
  keyPointZh: z.string().min(4).max(120),
  sourceQuoteZh: z.string().min(8).max(400),
});

const draftSchema = z.object({
  outcomeHint: outcomeHintSchema,
  points: z.array(pointSchema).min(1).max(5),
});

export type JudgmentSummaryDraftPoint = z.infer<typeof pointSchema>;
export type JudgmentSummaryDraft = z.infer<typeof draftSchema>;

export function normalizeForQuoteMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Quote must appear in source (whitespace-normalized). */
export function sourceQuoteMatchesExcerpt(
  quote: string,
  sourcePlainText: string,
): boolean {
  const q = normalizeForQuoteMatch(quote);
  if (!q) return false;
  const src = normalizeForQuoteMatch(sourcePlainText);
  if (src.includes(q)) return true;
  return sourcePlainText.includes(quote.trim());
}

const SYSTEM = `你是香港司法公開紀錄的摘要助手（Renocheck Track 1 dry-run）。
只根據提供的判詞／聆訊紀錄摘錄文字作答，使用繁體中文（香港），語氣中性、事實性。
禁止：黑店、騙子、斷言刑事定罪、誇大風險。
每個 keyPointZh ≤120 字；sourceQuoteZh 必須為摘錄中的原文連續片段（可含英文），勿改寫。
outcomeHint（以裝修公司／被告角度）：defendant_liable | defendant_not_liable | partial | procedural_only | unclear。
反申索成立、申索被駁回、被告勝訴 → defendant_not_liable。程序性裁決（上訴許可等）→ procedural_only。
若裁決僅為拒絕上訴許可／不上訴法庭，outcomeHint 須跟原審對被告之結果（例：原審判被告敗訴 → defendant_liable），唔好僅因屬上訴程序而標 procedural_only。
摘要內金額或數字必須在對應 sourceQuoteZh 原文出現；否則勿寫該數字。`;

export async function draftJudgmentSummaryFromPlainText(params: {
  caseRef: string;
  defendantLabel: string;
  partiesLine?: string;
  sourcePlainText: string;
}): Promise<JudgmentSummaryDraft> {
  if (!isLlmConfigured()) {
    throw new Error("llm_not_configured");
  }
  const model = resolveRiskReportModel();
  if (!model) {
    throw new Error("llm_not_configured");
  }

  const excerpt = params.sourcePlainText.slice(0, 14_000);
  const { object } = await generateObject({
    model,
    schema: draftSchema,
    system: SYSTEM,
    prompt: [
      `案號：${params.caseRef}`,
      params.partiesLine ? `雙方：${params.partiesLine}` : "",
      `被告／查詢側標籤：${params.defendantLabel}`,
      "",
      "【公開紀錄摘錄】",
      excerpt,
      "",
      "輸出 2–4 條要點；每條附一則原文引句（必出自摘錄）。",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const validatedPoints: JudgmentSummaryDraftPoint[] = [];
  for (const p of object.points) {
    let quote = p.sourceQuoteZh;
    if (!sourceQuoteMatchesExcerpt(quote, params.sourcePlainText)) {
      const shorter = p.sourceQuoteZh.slice(0, 120).trim();
      if (sourceQuoteMatchesExcerpt(shorter, params.sourcePlainText)) {
        quote = shorter;
      } else {
        continue;
      }
    }
    const candidate = { keyPointZh: p.keyPointZh, sourceQuoteZh: quote };
    if (!keyPointNumbersAppearInQuote(candidate.keyPointZh, candidate.sourceQuoteZh)) {
      continue;
    }
    const sanitized = sanitizeSummaryPoint(candidate);
    if (sanitized) validatedPoints.push(sanitized);
  }

  if (validatedPoints.length === 0) {
    throw new Error("summary_draft_no_valid_quotes");
  }

  return {
    outcomeHint: object.outcomeHint,
    points: validatedPoints,
  };
}

export async function draftJudgmentSummaryWithRetry(
  params: Parameters<typeof draftJudgmentSummaryFromPlainText>[0],
): Promise<JudgmentSummaryDraft> {
  try {
    return await draftJudgmentSummaryFromPlainText(params);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/schema|No object generated/i.test(msg)) throw e;
    return await draftJudgmentSummaryFromPlainText(params);
  }
}
