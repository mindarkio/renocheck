import { z } from "zod";
import { QUOTE_CHECK_ITEMS, type QuoteCheckStatus } from "@/lib/quote-selfcheck";
import { isQuoteArithmeticEnabled } from "@/lib/quote-analysis/config";
import {
  QUOTE_FINDING_ARITHMETIC_CLEAR_ZH,
  QUOTE_FINDING_ARITHMETIC_MISMATCH_ZH,
  QUOTE_FINDING_CLEAR_ZH,
  QUOTE_FINDING_MISSING_ZH,
  QUOTE_FINDING_NA_ZH,
  QUOTE_FINDING_VAGUE_PREFIX_ZH,
} from "@/lib/quote-analysis/copy";

export const QUOTE_ANALYSIS_VERSION = "1.0.0";

const ARITHMETIC_ID = "arithmetic";

const STATUS_VALUES = ["clear", "vague", "missing", "na"] as const;

export function activeQuoteCheckIds(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const ids: string[] = QUOTE_CHECK_ITEMS.map((item) => item.id);
  if (isQuoteArithmeticEnabled(env)) ids.push(ARITHMETIC_ID);
  return ids;
}

export type StoredQuoteItem = {
  id: string;
  status: QuoteCheckStatus;
};

export type ParsedQuoteModel =
  | { kind: "not_quotation" }
  | { kind: "quotation"; items: StoredQuoteItem[] }
  | { kind: "invalid" };

function statusSchema() {
  return z.enum(STATUS_VALUES);
}

export function quoteLlmSchema(ids: readonly string[]) {
  const idTuple = ids as [string, ...string[]];
  return z.object({
    isQuotation: z.boolean(),
    items: z.array(
      z.object({
        id: z.enum(idTuple),
        status: statusSchema(),
      }),
    ),
  });
}

export function parseQuoteModelObject(
  value: unknown,
  ids: readonly string[] = activeQuoteCheckIds(),
): ParsedQuoteModel {
  const parsed = quoteLlmSchema(ids).safeParse(value);
  if (!parsed.success) return { kind: "invalid" };

  const byId = new Map<string, QuoteCheckStatus>();
  for (const item of parsed.data.items) {
    if (!byId.has(item.id)) byId.set(item.id, item.status);
  }

  const items: StoredQuoteItem[] = ids.map((id) => ({
    id,
    status: byId.get(id) ?? "missing",
  }));

  const informative = items.some(
    (item) => item.status === "clear" || item.status === "vague",
  );
  if (!parsed.data.isQuotation && !informative) {
    return { kind: "not_quotation" };
  }
  return { kind: "quotation", items };
}

export function quoteFindingText(item: StoredQuoteItem): string {
  if (item.id === ARITHMETIC_ID) {
    if (item.status === "clear") return QUOTE_FINDING_ARITHMETIC_CLEAR_ZH;
    if (item.status === "na") return QUOTE_FINDING_NA_ZH;
    return QUOTE_FINDING_ARITHMETIC_MISMATCH_ZH;
  }
  const source = QUOTE_CHECK_ITEMS.find((row) => row.id === item.id);
  if (item.status === "clear") {
    return source
      ? `${QUOTE_FINDING_CLEAR_ZH}${source.clearExample}`
      : QUOTE_FINDING_CLEAR_ZH;
  }
  if (item.status === "vague") {
    return source
      ? `${QUOTE_FINDING_VAGUE_PREFIX_ZH}${source.vagueExample}`
      : QUOTE_FINDING_VAGUE_PREFIX_ZH;
  }
  if (item.status === "missing") return QUOTE_FINDING_MISSING_ZH;
  return QUOTE_FINDING_NA_ZH;
}

export function quoteItemLabel(id: string): string {
  if (id === ARITHMETIC_ID) return "加總唔一致";
  return QUOTE_CHECK_ITEMS.find((row) => row.id === id)?.label ?? id;
}
