import "server-only";

import { takeMemoryRateLimit } from "@/lib/memory-rate-limit";
import {
  isQuoteAnalysisAvailable,
  microUsdFromTokens,
  reserveMicroUsd,
} from "@/lib/quote-analysis/config";
import {
  anonymousBudgetAllows,
  noteAnonymousSpend,
  takeAnonymousQuoteSlot,
} from "@/lib/quote-analysis/anon-budget";
import {
  QUOTE_ACK_ERROR_ZH,
  QUOTE_ANON_LIMIT_ZH,
  QUOTE_BUDGET_ZH,
  QUOTE_FAILED_ZH,
  QUOTE_NOT_QUOTATION_ZH,
  QUOTE_PDF_ENCRYPTED_ZH,
  QUOTE_PDF_MAGIC_ZH,
  QUOTE_PDF_PAGES_ZH,
  QUOTE_PDF_SIZE_ZH,
  QUOTE_PDF_TYPE_ZH,
  QUOTE_PDF_UNREADABLE_ZH,
  QUOTE_RATE_LIMIT_ZH,
  QUOTE_UNAVAILABLE_API_ZH,
} from "@/lib/quote-analysis/copy";
import { inspectPdf, type PdfRejectReason } from "@/lib/quote-analysis/pdf";
import type { QuoteModelResult } from "@/lib/quote-analysis/provider";
import { parseQuoteModelObject, type StoredQuoteItem } from "@/lib/quote-analysis/schema";
import { quoteSealKey, sealQuoteResult } from "@/lib/quote-analysis/seal";

const ANALYZE_WINDOW_MS = 60_000;
const ANALYZE_LIMIT = 5;
const MAX_DECLARED_BYTES = 4_500_000;

const PDF_MESSAGE: Record<PdfRejectReason, string> = {
  type: QUOTE_PDF_TYPE_ZH,
  magic: QUOTE_PDF_MAGIC_ZH,
  size: QUOTE_PDF_SIZE_ZH,
  pages: QUOTE_PDF_PAGES_ZH,
  encrypted: QUOTE_PDF_ENCRYPTED_ZH,
  unreadable: QUOTE_PDF_UNREADABLE_ZH,
};

export type AnonymousAnalysisBody = {
  error?: string;
  message?: string;
  sealed?: string;
};

/**
 * Logged-out analysis. The HTTP body is only a sealed blob or an error.
 * Checklist rows and the company name stay inside the ciphertext.
 */
export async function runAnonymousQuoteAnalysis(input: {
  acknowledged: boolean;
  mediaType: string;
  bytes: Uint8Array | null;
  ip: string;
  env?: Record<string, string | undefined>;
  now?: number;
  model: (bytes: Uint8Array) => Promise<QuoteModelResult>;
}): Promise<{ status: number; body: AnonymousAnalysisBody }> {
  const env = input.env ?? process.env;
  const now = input.now ?? Date.now();
  if (!isQuoteAnalysisAvailable(env) || !quoteSealKey(env)) {
    return { status: 401, body: { error: "auth_required", message: QUOTE_UNAVAILABLE_API_ZH } };
  }
  if (!takeMemoryRateLimit(`quote:${input.ip}`, ANALYZE_LIMIT, ANALYZE_WINDOW_MS, now)) {
    return { status: 429, body: { error: "rate_limited", message: QUOTE_RATE_LIMIT_ZH } };
  }
  if (!input.acknowledged) {
    return { status: 400, body: { error: "acknowledgement_required", message: QUOTE_ACK_ERROR_ZH } };
  }
  if (!input.bytes) {
    return { status: 400, body: { error: "invalid_pdf", message: QUOTE_PDF_TYPE_ZH } };
  }
  if (input.bytes.byteLength > MAX_DECLARED_BYTES) {
    return { status: 413, body: { error: "invalid_pdf", message: QUOTE_PDF_SIZE_ZH } };
  }
  const pdf = inspectPdf(input.bytes, input.mediaType);
  if (!pdf.ok) {
    return { status: 400, body: { error: "invalid_pdf", message: PDF_MESSAGE[pdf.reason] } };
  }

  const slot = await takeAnonymousQuoteSlot(input.ip, env, new Date(now));
  if (slot === "limited") {
    return { status: 429, body: { error: "anon_limited", message: QUOTE_ANON_LIMIT_ZH } };
  }
  if (slot !== "ok") {
    return { status: 503, body: { error: "quote_unavailable", message: QUOTE_FAILED_ZH } };
  }

  const reserve = reserveMicroUsd(pdf.pageCount);
  const budget = await anonymousBudgetAllows(reserve, env);
  if (budget === "budget") {
    return { status: 503, body: { error: "quote_paused", message: QUOTE_BUDGET_ZH } };
  }
  if (budget !== "ok") {
    return { status: 503, body: { error: "quote_unavailable", message: QUOTE_FAILED_ZH } };
  }

  let modelResult: QuoteModelResult;
  try {
    modelResult = await input.model(input.bytes);
  } catch {
    return { status: 503, body: { error: "quote_llm_failed", message: QUOTE_FAILED_ZH } };
  }
  const actual =
    modelResult.inputTokens == null || modelResult.outputTokens == null
      ? null
      : microUsdFromTokens(modelResult.inputTokens, modelResult.outputTokens);
  const parsed = parseQuoteModelObject(modelResult.object);
  if (parsed.kind === "invalid") {
    return { status: 503, body: { error: "quote_llm_failed", message: QUOTE_FAILED_ZH } };
  }
  if (parsed.kind === "not_quotation") {
    return { status: 200, body: { error: "not_quotation", message: QUOTE_NOT_QUOTATION_ZH } };
  }

  const items: StoredQuoteItem[] = parsed.items.map((item) => ({
    id: item.id,
    status: item.status,
  }));
  let sealed: string;
  try {
    sealed = sealQuoteResult(
      {
        items,
        companyName: parsed.companyName,
        pageCount: pdf.pageCount,
        inputTokens: modelResult.inputTokens,
        outputTokens: modelResult.outputTokens,
        actualMicroUsd: actual,
      },
      env,
      now,
    ).sealed;
  } catch {
    return { status: 503, body: { error: "quote_unavailable", message: QUOTE_FAILED_ZH } };
  }
  await noteAnonymousSpend(actual ?? reserve);
  return { status: 200, body: { sealed } };
}
