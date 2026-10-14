import type { z } from "zod";
import type { confidenceSchema, discussionHighlightSchema, gradeSchema } from "./report-schema";

type Confidence = z.infer<typeof confidenceSchema>;
type Grade = z.infer<typeof gradeSchema>;

const GRADE_LADDER: Grade[] = ["A", "B", "C", "D", "E", "F"];
const NO_DISCUSSION_THEME = "未檢出相關討論";
const DISPUTE_THEME_PATTERN = /超支|爛尾|糾紛|投訴|苦主|溝通|工程質素/;

export type LlmRiskSlice = {
  grade: string;
  confidence: Confidence;
  summaryZh: string;
  discussionCount: number;
  themes: string[];
  highlights: z.infer<typeof discussionHighlightSchema>[];
};

export type RetrievalEvidence = {
  /** Post-L1 hits sent to the LLM */
  llmHitCount: number;
  boundHitCount: number;
  serpHitCount: number;
  /** Bound hits whose title/snippet match dispute keywords */
  boundDisputeHitCount?: number;
  boundPraiseHitCount?: number;
};

function gradeIndex(grade: string): number {
  const i = GRADE_LADDER.indexOf(grade as Grade);
  return i === -1 ? GRADE_LADDER.indexOf("C") : i;
}

/** Lower index = better grade; cap to max (e.g. C) without upgrading. */
export function capGradeToMax(grade: string, max: Grade): Grade {
  const g = GRADE_LADDER[gradeIndex(grade)] ?? "C";
  const m = GRADE_LADDER[gradeIndex(max)] ?? "C";
  return GRADE_LADDER[Math.min(gradeIndex(g), gradeIndex(m))];
}

function allowsSevereGrade(
  highlights: LlmRiskSlice["highlights"],
  themes: string[],
): boolean {
  if (highlights.length < 2) return false;
  return themes.some((t) => DISPUTE_THEME_PATTERN.test(t));
}

function applyGradeCap(slice: LlmRiskSlice, evidence: RetrievalEvidence): Grade {
  let grade = GRADE_LADDER[gradeIndex(slice.grade)] ?? "C";

  if (slice.highlights.length === 0) {
    // No discussion evidence: fixed C (no A/B optimism, no D–F alarm).
    grade = "C";
  } else if (evidence.boundHitCount === 0 && evidence.serpHitCount > 0) {
    grade = capGradeToMax(grade, "C");
  }
  if (!allowsSevereGrade(slice.highlights, slice.themes)) {
    grade = capGradeToMax(grade, "C");
  }

  return grade;
}

export function stripNoDiscussionTheme(
  themes: string[],
  evidence: RetrievalEvidence,
  highlightsLen: number,
): string[] {
  const shouldStrip =
    highlightsLen > 0 ||
    evidence.boundHitCount > 0 ||
    evidence.llmHitCount > 0;
  if (!shouldStrip) return themes;
  return themes.filter((t) => t !== NO_DISCUSSION_THEME);
}

const BOUND_NO_HIGHLIGHT_SUMMARY =
  "根據本次可檢索的公開來源，已確認與查詢字串相關的來源，但未能形成可引用的討論摘要，請自行核實。";

const ZERO_EVIDENCE_CAUTIOUS_SUMMARY =
  "根據本次可檢索的公開來源，未檢出與查詢對象相關、可引用的裝修糾紛討論摘要；資料有限，請自行核實。";

/** Zero highlights: avoid implying「無風險」when evidence is absent. */
const OVERCONFIDENT_ZERO_EVIDENCE =
  /暫無(具體)?風險|無風險|沒有風險|安全放心/u;

function trimSummaryToMax(text: string, max = 120): string {
  return text.length <= max ? text : text.slice(0, max);
}

function maybeAdjustSummaryForBoundOnly(
  slice: LlmRiskSlice,
  evidence: RetrievalEvidence,
): string {
  if (evidence.llmHitCount <= 0 || slice.highlights.length > 0) {
    return slice.summaryZh;
  }
  return trimSummaryToMax(BOUND_NO_HIGHLIGHT_SUMMARY);
}

function maybeAdjustSummaryForZeroEvidence(
  summaryZh: string,
  highlightsLen: number,
  evidence: RetrievalEvidence,
): string {
  if (highlightsLen > 0 || evidence.boundHitCount > 0) {
    return summaryZh;
  }
  if (OVERCONFIDENT_ZERO_EVIDENCE.test(summaryZh)) {
    return trimSummaryToMax(ZERO_EVIDENCE_CAUTIOUS_SUMMARY);
  }
  return summaryZh;
}

/** P0 + P2-A: confidence, counts, themes, grade cap (post-LLM). */
export function calibrateLlmRiskSlice(
  slice: LlmRiskSlice,
  evidence: RetrievalEvidence,
): LlmRiskSlice {
  const highlights = slice.highlights;
  const llmHitCount = evidence.llmHitCount;

  const discussionCount =
    highlights.length === 0
      ? 0
      : Math.min(slice.discussionCount, highlights.length, llmHitCount);

  const sparseEvidence = llmHitCount <= 2 || highlights.length <= 1;
  const confidence: Confidence =
    sparseEvidence && slice.confidence !== "low" ? "low" : slice.confidence;

  const themes = stripNoDiscussionTheme(slice.themes, evidence, highlights.length);
  const grade = applyGradeCap(slice, evidence);
  let summaryZh = maybeAdjustSummaryForBoundOnly(slice, evidence);
  summaryZh = maybeAdjustSummaryForZeroEvidence(
    summaryZh,
    highlights.length,
    evidence,
  );

  let finalConfidence = confidence;
  if (evidence.llmHitCount > 0 && highlights.length === 0) {
    finalConfidence = "low";
  }

  return {
    ...slice,
    grade,
    discussionCount,
    confidence: finalConfidence,
    themes,
    summaryZh,
  };
}
