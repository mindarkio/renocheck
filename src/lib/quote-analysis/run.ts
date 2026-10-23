import "server-only";

import { takeMemoryRateLimit } from "@/lib/memory-rate-limit";
import {
  QUOTE_FREE_ANALYSES_PER_DAY,
  isQuoteAnalysisAvailable,
  microUsdFromTokens,
  quoteDailyBudgetMicroUsd,
  reserveMicroUsd,
} from "@/lib/quote-analysis/config";
import {
  QUOTE_ACK_ERROR_ZH,
  QUOTE_AUTH_REQUIRED_ZH,
  QUOTE_BUDGET_ZH,
  QUOTE_FAILED_ZH,
  QUOTE_NOT_QUOTATION_ZH,
  QUOTE_PDF_ENCRYPTED_ZH,
  QUOTE_PDF_MAGIC_ZH,
  QUOTE_PDF_PAGES_ZH,
  QUOTE_PDF_SIZE_ZH,
  QUOTE_PDF_TYPE_ZH,
  QUOTE_PDF_UNREADABLE_ZH,
  QUOTE_QUOTA_ZH,
  QUOTE_RATE_LIMIT_ZH,
  QUOTE_UNAVAILABLE_API_ZH,
} from "@/lib/quote-analysis/copy";
import { inspectPdf, type PdfRejectReason } from "@/lib/quote-analysis/pdf";
import {
  parseQuoteModelObject,
  quoteFindingText,
  quoteItemLabel,
  type StoredQuoteItem,
} from "@/lib/quote-analysis/schema";
import type { QuoteModelResult } from "@/lib/quote-analysis/provider";
import type { QuoteStore } from "@/lib/quote-analysis/store";

const ANALYZE_WINDOW_MS = 60_000;
const ANALYZE_LIMIT = 5;
const MAX_DECLARED_BYTES = 4_500_000;

export type QuoteModel = (
  bytes: Uint8Array,
) => Promise<QuoteModelResult>;

export type QuoteAnalysisBody = {
  error?: string;
  message?: string;
  id?: string;
  items?: Array<{ id: string; label: string; status: string; finding: string }>;
};

export type QuoteAnalysisResponse = {
  status: number;
  body: QuoteAnalysisBody;
};

const PDF_MESSAGE: Record<PdfRejectReason, string> = {
  type: QUOTE_PDF_TYPE_ZH,
  magic: QUOTE_PDF_MAGIC_ZH,
  size: QUOTE_PDF_SIZE_ZH,
  pages: QUOTE_PDF_PAGES_ZH,
  encrypted: QUOTE_PDF_ENCRYPTED_ZH,
  unreadable: QUOTE_PDF_UNREADABLE_ZH,
};

export async function runQuoteAnalysis(input: {
  userId: string | null;
  acknowledged: boolean;
  mediaType: string;
  bytes: Uint8Array | null;
  ip: string;
  env?: Record<string, string | undefined>;
  now?: number;
  model: QuoteModel;
  store: QuoteStore;
}): Promise<QuoteAnalysisResponse> {
  const env = input.env ?? process.env;
  const now = input.now ?? Date.now();

  if (!isQuoteAnalysisAvailable(env)) {
    return json(503, { error: "quote_unavailable", message: QUOTE_UNAVAILABLE_API_ZH });
  }
  if (!input.userId) {
    return json(401, { error: "auth_required", message: QUOTE_AUTH_REQUIRED_ZH });
  }
  if (!takeMemoryRateLimit(`quote:${input.ip}`, ANALYZE_LIMIT, ANALYZE_WINDOW_MS, now)) {
    return json(429, { error: "rate_limited", message: QUOTE_RATE_LIMIT_ZH });
  }
  if (!input.acknowledged) {
    return json(400, {
      error: "acknowledgement_required",
      message: QUOTE_ACK_ERROR_ZH,
    });
  }
  if (!input.bytes) {
    return json(400, { error: "invalid_pdf", message: QUOTE_PDF_TYPE_ZH });
  }
  if (input.bytes.byteLength > MAX_DECLARED_BYTES) {
    return json(413, { error: "invalid_pdf", message: QUOTE_PDF_SIZE_ZH });
  }

  const pdf = inspectPdf(input.bytes, input.mediaType);
  if (!pdf.ok) {
    return json(400, { error: "invalid_pdf", message: PDF_MESSAGE[pdf.reason] });
  }

  if (
    !takeMemoryRateLimit(
      `quote-user:${input.userId}`,
      ANALYZE_LIMIT,
      ANALYZE_WINDOW_MS,
      now,
    )
  ) {
    return json(429, { error: "rate_limited", message: QUOTE_RATE_LIMIT_ZH });
  }

  const reserve = reserveMicroUsd(pdf.pageCount);
  const begun = await input.store.begin({
    userId: input.userId,
    reserveMicroUsd: reserve,
    dailyLimit: QUOTE_FREE_ANALYSES_PER_DAY,
    capMicroUsd: quoteDailyBudgetMicroUsd(env),
  });
  if (!begun.ok) {
    if (begun.reason === "quota") {
      return json(429, { error: "quota", message: QUOTE_QUOTA_ZH });
    }
    if (begun.reason === "budget") {
      return json(503, { error: "quote_paused", message: QUOTE_BUDGET_ZH });
    }
    return json(503, { error: "quote_unavailable", message: QUOTE_FAILED_ZH });
  }

  let modelResult: QuoteModelResult;
  try {
    modelResult = await input.model(input.bytes);
  } catch {
    await input.store.finish({
      claimId: begun.claimId,
      outcome: "failed",
      actualMicroUsd: null,
      pageCount: pdf.pageCount,
      items: null,
      inputTokens: null,
      outputTokens: null,
    });
    return json(503, { error: "quote_llm_failed", message: QUOTE_FAILED_ZH });
  }

  const actual =
    modelResult.inputTokens == null && modelResult.outputTokens == null
      ? null
      : microUsdFromTokens(
          modelResult.inputTokens ?? 0,
          modelResult.outputTokens ?? 0,
        );
  const parsed = parseQuoteModelObject(modelResult.object);

  if (parsed.kind === "invalid") {
    await input.store.finish({
      claimId: begun.claimId,
      outcome: "failed",
      actualMicroUsd: actual,
      pageCount: pdf.pageCount,
      items: null,
      inputTokens: modelResult.inputTokens,
      outputTokens: modelResult.outputTokens,
    });
    return json(503, { error: "quote_llm_failed", message: QUOTE_FAILED_ZH });
  }

  if (parsed.kind === "not_quotation") {
    await input.store.finish({
      claimId: begun.claimId,
      outcome: "failed",
      actualMicroUsd: actual,
      pageCount: pdf.pageCount,
      items: null,
      inputTokens: modelResult.inputTokens,
      outputTokens: modelResult.outputTokens,
    });
    return json(200, { error: "not_quotation", message: QUOTE_NOT_QUOTATION_ZH });
  }

  const stored = await input.store.finish({
    claimId: begun.claimId,
    outcome: "succeeded",
    actualMicroUsd: actual,
    pageCount: pdf.pageCount,
    items: parsed.items,
    inputTokens: modelResult.inputTokens,
    outputTokens: modelResult.outputTokens,
  });
  if (!stored.analysisId) {
    return json(503, { error: "quote_llm_failed", message: QUOTE_FAILED_ZH });
  }

  return json(200, {
    id: stored.analysisId,
    items: parsed.items.map(presentItem),
  });
}

function presentItem(item: StoredQuoteItem) {
  return {
    id: item.id,
    label: quoteItemLabel(item.id),
    status: item.status,
    finding: quoteFindingText(item),
  };
}

function json(status: number, body: QuoteAnalysisBody): QuoteAnalysisResponse {
  return { status, body };
}
