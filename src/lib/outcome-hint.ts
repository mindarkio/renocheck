import { z } from "zod";

/** 以裝修公司（被告）角度 — Track 1 v1.1 */
export const outcomeHintSchema = z.enum([
  "defendant_liable",
  "defendant_not_liable",
  "partial",
  "procedural_only",
  "unclear",
]);

export type OutcomeHint = z.infer<typeof outcomeHintSchema>;

const LEGACY_OUTCOME_HINTS: Record<string, OutcomeHint> = {
  judgment_against_defendant: "defendant_liable",
  dismissed_or_withdrawn: "defendant_not_liable",
  partial_liability: "partial",
  settled: "unclear",
  unknown: "unclear",
};

export function parseOutcomeHint(raw: string | null | undefined): OutcomeHint | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  const direct = outcomeHintSchema.safeParse(t);
  if (direct.success) return direct.data;
  return LEGACY_OUTCOME_HINTS[t];
}
