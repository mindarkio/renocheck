import { z } from "zod";
import type { WebSearchHit } from "./web-search";
import { filterHighlightsToAllowedUrls } from "./highlight-evidence-alignment";
import type { LlmRiskSlice } from "./risk-report-calibration";
import {
  actionableClauseSchema,
  confidenceSchema,
  discussionHighlightSchema,
  disputeLevelSchema,
  gradeSchema,
  type ActionableClause,
} from "./report-schema";

/** Structured LLM output (v2.2.0 P4); grade/dispute fields are hints until calibration v2. */
export const llmSliceSchema = z.object({
  grade: gradeSchema,
  confidence: confidenceSchema,
  summaryZh: z.string().max(120),
  discussionCount: z.number().int().nonnegative().max(50),
  themes: z.array(z.string()).max(6),
  highlights: z.array(discussionHighlightSchema).max(8),
  disputeLevel: disputeLevelSchema.optional(),
  recentDisputeCount: z.number().int().nonnegative().max(20).optional(),
  customClauses: z.array(actionableClauseSchema).max(8).default([]),
});

export type LlmRiskSliceOutput = z.infer<typeof llmSliceSchema>;

export type LlmDisputeHints = {
  disputeLevel?: z.infer<typeof disputeLevelSchema>;
  recentDisputeCount?: number;
};

export type BoundLlmSlice = {
  calibrationInput: LlmRiskSlice;
  actionableClauses: ActionableClause[];
  disputeHints: LlmDisputeHints;
  highlightsDropped: number;
};

/** Drop highlight URLs not in L1 webHits; sync discussionCount (M2 pre-check). */
export function bindLlmSliceToWebHits(
  slice: LlmRiskSliceOutput,
  webHits: WebSearchHit[],
): BoundLlmSlice {
  const allowedUrls = new Set(webHits.map((h) => h.url));
  const { highlights, dropped } = filterHighlightsToAllowedUrls(
    slice.highlights,
    allowedUrls,
  );

  const discussionCount =
    highlights.length === 0
      ? 0
      : Math.min(slice.discussionCount, highlights.length);

  const calibrationInput: LlmRiskSlice = {
    grade: slice.grade,
    confidence: slice.confidence,
    summaryZh: slice.summaryZh,
    discussionCount,
    themes: slice.themes,
    highlights,
  };

  return {
    calibrationInput,
    actionableClauses: slice.customClauses,
    disputeHints: {
      disputeLevel: slice.disputeLevel,
      recentDisputeCount: slice.recentDisputeCount,
    },
    highlightsDropped: dropped,
  };
}
