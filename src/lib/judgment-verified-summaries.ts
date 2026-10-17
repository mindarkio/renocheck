/** SSOT shape for scripts/fixtures/judgment-summaries-verified.json */

import { z } from "zod";
import { isLegalrefJudgmentSourceUrl } from "./legal-event-source-url";
import { outcomeHintSchema } from "./outcome-hint";

const legalrefSourceUrlSchema = z
  .string()
  .url()
  .refine((url) => isLegalrefJudgmentSourceUrl(url), {
    message: "sourceUrl_must_be_legalref_judiciary_hk",
  });

export const verifiedSummaryPointSchema = z.object({
  point_index: z.number().int().positive().max(8),
  keyPointZh: z.string().min(1).max(200),
  sourceQuoteZh: z.string().min(1),
});

export const verifiedSummaryRowSchema = z.object({
  caseRef: z.string().min(1).max(80),
  sourceUrl: legalrefSourceUrlSchema,
  outcome_hint: outcomeHintSchema,
  hearing_points_source: z.literal("ai_verified"),
  points: z.array(verifiedSummaryPointSchema).min(1).max(8),
});

export const verifiedSummariesFileSchema = z
  .array(verifiedSummaryRowSchema)
  .min(1);

export type VerifiedSummaryPoint = {
  point_index: number;
  keyPointZh: string;
  sourceQuoteZh: string;
};

export type VerifiedSummaryRow = {
  caseRef: string;
  sourceUrl: string;
  outcome_hint: string;
  hearing_points_source: "ai_verified";
  points: VerifiedSummaryPoint[];
};

export function normCaseRefKey(caseRef: string): string {
  return caseRef.replace(/\s+/g, "").toUpperCase();
}

export function sortVerifiedPoints(points: VerifiedSummaryPoint[]): VerifiedSummaryPoint[] {
  return [...points].sort((a, b) => a.point_index - b.point_index);
}

export function verifiedRowToDbUpdate(row: VerifiedSummaryRow) {
  const points = sortVerifiedPoints(row.points);
  return {
    hearing_key_points_zh: points.map((p) => p.keyPointZh),
    hearing_key_point_quotes_zh: points.map((p) => p.sourceQuoteZh),
    outcome_hint: row.outcome_hint,
    hearing_points_source: row.hearing_points_source,
    review_status: "human_verified" as const,
  };
}

/** Canonical JSON document shape for round-trip compare (one row). */
export function canonicalVerifiedRow(row: VerifiedSummaryRow): VerifiedSummaryRow {
  const points = sortVerifiedPoints(row.points).map((p) => ({
    point_index: p.point_index,
    keyPointZh: p.keyPointZh,
    sourceQuoteZh: p.sourceQuoteZh,
  }));
  return {
    caseRef: row.caseRef,
    sourceUrl: row.sourceUrl,
    outcome_hint: row.outcome_hint,
    hearing_points_source: "ai_verified",
    points,
  };
}

export type DbVerifiedFields = {
  case_ref: string;
  hearing_key_points_zh: unknown;
  hearing_key_point_quotes_zh?: unknown;
  outcome_hint: string | null;
  hearing_points_source: string | null;
};

/** Rebuild fixture-shaped row from DB using expected point_index order. */
export function reconstructedFromDb(
  expected: VerifiedSummaryRow,
  db: DbVerifiedFields,
): VerifiedSummaryRow | null {
  const sorted = sortVerifiedPoints(expected.points);
  const keyPoints = Array.isArray(db.hearing_key_points_zh)
    ? (db.hearing_key_points_zh as string[])
    : [];
  const quotes = Array.isArray(db.hearing_key_point_quotes_zh)
    ? (db.hearing_key_point_quotes_zh as string[])
    : [];
  if (keyPoints.length !== sorted.length || quotes.length !== sorted.length) {
    return null;
  }
  const points = sorted.map((exp, i) => ({
    point_index: exp.point_index,
    keyPointZh: keyPoints[i]!,
    sourceQuoteZh: quotes[i]!,
  }));
  if (db.hearing_points_source !== "ai_verified") return null;
  if ((db.outcome_hint ?? "") !== expected.outcome_hint) return null;
  for (let i = 0; i < sorted.length; i++) {
    if (keyPoints[i] !== sorted[i]!.keyPointZh) return null;
    if (quotes[i] !== sorted[i]!.sourceQuoteZh) return null;
  }
  return canonicalVerifiedRow({
    caseRef: expected.caseRef,
    sourceUrl: expected.sourceUrl,
    outcome_hint: expected.outcome_hint,
    hearing_points_source: "ai_verified",
    points,
  });
}

export function verifiedRowsEqual(a: VerifiedSummaryRow, b: VerifiedSummaryRow): boolean {
  return JSON.stringify(canonicalVerifiedRow(a)) === JSON.stringify(canonicalVerifiedRow(b));
}

export function parseVerifiedSummariesFile(raw: unknown): VerifiedSummaryRow[] {
  return verifiedSummariesFileSchema.parse(raw);
}
