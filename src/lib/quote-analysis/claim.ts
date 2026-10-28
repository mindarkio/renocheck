import "server-only";

import { takeAuthRateLimit } from "@/lib/auth/rate-limit";
import { QUOTE_FREE_ANALYSES_PER_DAY } from "@/lib/quote-analysis/config";
import {
  QUOTE_BUDGET_ZH,
  QUOTE_FAILED_ZH,
  QUOTE_QUOTA_ZH,
  QUOTE_SEAL_EXPIRED_ZH,
  QUOTE_SEAL_USED_ZH,
  QUOTE_UNAVAILABLE_API_ZH,
} from "@/lib/quote-analysis/copy";
import {
  countUserQuoteUsesToday,
  insertQuoteChecklist,
} from "@/lib/quote-analysis/anon-budget";
import { saveQuoteCompanyNames } from "@/lib/quote-analysis/company-names";
import { openQuoteResult } from "@/lib/quote-analysis/seal";
import {
  normalizeQuoteCompanyName,
  quoteFindingText,
  quoteItemLabel,
  type StoredQuoteItem,
} from "@/lib/quote-analysis/schema";

const SEAL_SLOT_WINDOW_MS = 35 * 60 * 1000;

export type ClaimBody = {
  error?: string;
  message?: string;
  id?: string;
  companyName?: string | null;
  items?: Array<{ id: string; label: string; status: string; finding: string }>;
};

function presentItem(item: StoredQuoteItem) {
  return {
    id: item.id,
    label: quoteItemLabel(item.id),
    status: item.status,
    finding: quoteFindingText(item),
  };
}

function checklistItems(value: unknown): StoredQuoteItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: StoredQuoteItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const record = row as { id?: unknown; status?: unknown };
    if (typeof record.id !== "string" || typeof record.status !== "string") return null;
    if (!["clear", "vague", "missing", "na"].includes(record.status)) return null;
    items.push({
      id: record.id,
      status: record.status as StoredQuoteItem["status"],
    });
  }
  return items;
}

/**
 * Decrypt a sealed result, reject expiry and replay, then store checklist
 * statuses and the extracted company name on the caller's row.
 */
export async function claimSealedQuote(input: {
  userId: string;
  sealed: string;
  env?: Record<string, string | undefined>;
  now?: number;
}): Promise<{ status: number; body: ClaimBody }> {
  const env = input.env ?? process.env;
  const now = input.now ?? Date.now();
  let opened;
  try {
    opened = openQuoteResult(input.sealed, env, now);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "seal_expired") {
      return { status: 410, body: { error: "seal_expired", message: QUOTE_SEAL_EXPIRED_ZH } };
    }
    if (code === "seal_unavailable") {
      return { status: 503, body: { error: "quote_unavailable", message: QUOTE_UNAVAILABLE_API_ZH } };
    }
    return { status: 400, body: { error: "seal_invalid", message: QUOTE_FAILED_ZH } };
  }

  const items = checklistItems(opened.items);
  if (!items || typeof opened.pageCount !== "number") {
    return { status: 400, body: { error: "seal_invalid", message: QUOTE_FAILED_ZH } };
  }

  const used = await countUserQuoteUsesToday(input.userId);
  if (used == null) {
    return { status: 503, body: { error: "quote_unavailable", message: QUOTE_FAILED_ZH } };
  }
  if (used >= QUOTE_FREE_ANALYSES_PER_DAY) {
    return { status: 429, body: { error: "quota", message: QUOTE_QUOTA_ZH } };
  }

  const analysisId = await insertQuoteChecklist({
    userId: input.userId,
    pageCount: opened.pageCount,
    items,
    inputTokens: opened.inputTokens,
    outputTokens: opened.outputTokens,
    actualMicroUsd: opened.actualMicroUsd,
  });
  if (!analysisId) {
    return { status: 503, body: { error: "quote_unavailable", message: QUOTE_BUDGET_ZH } };
  }

  // After the quota and insert succeed, so a 429 or 503 does not burn the seal.
  const slot = await takeAuthRateLimit({
    key: `quote-seal:${opened.nonce}`,
    limit: 1,
    windowMs: SEAL_SLOT_WINDOW_MS,
  });
  if (slot === "limited") {
    return { status: 409, body: { error: "seal_used", message: QUOTE_SEAL_USED_ZH } };
  }
  if (slot !== "ok") {
    return { status: 503, body: { error: "quote_unavailable", message: QUOTE_FAILED_ZH } };
  }

  await saveQuoteCompanyNames({
    analysisId,
    userId: input.userId,
    extracted: normalizeQuoteCompanyName(opened.companyName),
  });

  return {
    status: 200,
    body: {
      id: analysisId,
      companyName: normalizeQuoteCompanyName(opened.companyName),
      items: items.map(presentItem),
    },
  };
}
