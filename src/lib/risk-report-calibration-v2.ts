import type { z } from "zod";
import type {
  confidenceSchema,
  discussionHighlightSchema,
  evaluationSchema,
  gradeSchema,
} from "./report-schema";
import {
  dedupeDisputeHighlights,
  isDisputeHighlight,
  isRecentHighlight,
  meetsHighRiskDisputeEvidence,
  meetsSevereDisputeEvidence,
  ratedDisputeHighlights,
} from "./dispute-signals";
import {
  type LlmRiskSlice,
  type RetrievalEvidence,
  stripNoDiscussionTheme,
} from "./risk-report-calibration";
import { applyRiskBandToEvaluation } from "./risk-band-calibration";

type Grade = z.infer<typeof gradeSchema>;
type Confidence = z.infer<typeof confidenceSchema>;
type Evaluation = z.infer<typeof evaluationSchema>;
type Highlight = z.infer<typeof discussionHighlightSchema>;

const MWC_SPARSE_SUMMARY =
  "屋宇署小型工程承辦商名冊有登記；本次未檢出公開糾紛討論摘要，請自行核實牌照與合約條款。";

const UNINDEXED_SUMMARY =
  "根據本次可檢索的公開來源，未檢出與查詢對象相關、可引用的裝修糾紛討論摘要；資料有限，請自行核實。";

const BOUND_NO_HIGHLIGHT_SUMMARY =
  "根據本次可檢索的公開來源，已確認與查詢字串相關的來源，但未能形成可引用的討論摘要，請自行核實。";

const BOUND_DISPUTE_SNIPPET_SUMMARY =
  "根據本次可檢索的公開來源，有多則與查詢對象相關的討論出現糾紛／投訴相關字眼；請逐條點開下方來源核實。";

const RETRIEVAL_BIND_FAILURE_SUMMARY =
  "政府名冊有登記；在本站本次已檢索的公開網上來源中，未檢出與查證對象相關的糾紛或投訴討論摘要（不包括判詞紀錄）；結果只反映已檢索範圍，請自行核實。";

/** Raw organic count suggesting L1 bind failure (not「零討論」). */
const SERP_BIND_FAILURE_THRESHOLD = 5;

const OVERCONFIDENT_ZERO_EVIDENCE =
  /暫無(具體)?風險|無風險|沒有風險|安全放心/u;

export type CalibrateEvaluationParams = {
  slice: LlmRiskSlice;
  evidence: RetrievalEvidence;
  mwcMatched: boolean;
  mwcAmbiguous: boolean;
  generatedAt: string;
};

export type CalibratedReportFields = {
  grade: Grade;
  confidence: Confidence;
  summaryZh: string;
  evaluation: Evaluation;
  themes: string[];
  discussionCount: number;
};

function trimSummaryToMax(text: string, max = 120): string {
  return text.length <= max ? text : text.slice(0, max);
}

function disputeHighlights(highlights: Highlight[]): Highlight[] {
  return highlights.filter(isDisputeHighlight);
}

function allowsSevereGrade(
  highlights: Highlight[],
  generatedAt: string,
): boolean {
  return meetsSevereDisputeEvidence(highlights, generatedAt);
}

type MatrixRow = {
  overallGrade: Grade;
  displayGradeZh: string;
  confidence: Confidence;
  dataSaturation: Evaluation["dataSaturation"];
  disputeLevel: Evaluation["reputationTrack"]["disputeLevel"];
};

function matrixForZeroHighlights(
  mwcActive: boolean,
  boundHitCount: number,
  serpHitCount: number,
): MatrixRow {
  if (mwcActive && boundHitCount === 0) {
    if (serpHitCount >= SERP_BIND_FAILURE_THRESHOLD) {
      return {
        overallGrade: "C",
        displayGradeZh: "C",
        confidence: "low",
        dataSaturation: "sparse",
        disputeLevel: "none_detected",
      };
    }
    return {
      overallGrade: "C",
      displayGradeZh: "C",
      confidence: "low",
      dataSaturation: "sparse",
      disputeLevel: "none_detected",
    };
  }
  if (boundHitCount > 0) {
    return {
      overallGrade: "C",
      displayGradeZh: "C+",
      confidence: "low",
      dataSaturation: "moderate",
      disputeLevel: "none_detected",
    };
  }
  return {
    overallGrade: "C",
    displayGradeZh: "C",
    confidence: "low",
    dataSaturation: "unindexed",
    disputeLevel: "none_detected",
  };
}

function matrixForHighlights(
  highlights: Highlight[],
  generatedAt: string,
  boundHitCount: number,
): MatrixRow {
  const hl = highlights.length;
  const disputes = disputeHighlights(highlights);
  const dedupedDisputes = dedupeDisputeHighlights(highlights);
  const recentDispute = disputes.filter((h) =>
    isRecentHighlight(h, generatedAt),
  );

  let dataSaturation: Evaluation["dataSaturation"] = "moderate";
  if (hl >= 2) dataSaturation = "rich";
  else if (boundHitCount === 0) dataSaturation = "moderate";

  if (dedupedDisputes.length === 0) {
    return {
      overallGrade: "C",
      displayGradeZh: "C",
      confidence: hl >= 2 ? "medium" : "low",
      dataSaturation,
      disputeLevel: "none_detected",
    };
  }

  if (hl >= 3 && allowsSevereGrade(highlights, generatedAt)) {
    return {
      overallGrade: hl >= 4 ? "F" : "E",
      displayGradeZh: hl >= 4 ? "F" : "E",
      confidence: "high",
      dataSaturation: "rich",
      disputeLevel: "severe",
    };
  }

  if (meetsHighRiskDisputeEvidence(highlights, generatedAt)) {
    return {
      overallGrade: "D",
      displayGradeZh: "D",
      confidence: "high",
      dataSaturation: "rich",
      disputeLevel: "active_concerning",
    };
  }

  if (dedupedDisputes.length === 1) {
    const only = dedupedDisputes[0];
    const disputeLevel = isRecentHighlight(only, generatedAt)
      ? "active_concerning"
      : "historical_isolated";
    return {
      overallGrade: "C",
      displayGradeZh: "C",
      confidence: "medium",
      dataSaturation,
      disputeLevel,
    };
  }

  if (recentDispute.length > 0) {
    return {
      overallGrade: "C",
      displayGradeZh: "C",
      confidence: "medium",
      dataSaturation,
      disputeLevel: "active_concerning",
    };
  }

  return {
    overallGrade: "C",
    displayGradeZh: "C",
    confidence: "medium",
    dataSaturation,
    disputeLevel: "historical_isolated",
  };
}

function buildSummary(
  slice: LlmRiskSlice,
  evidence: RetrievalEvidence,
  row: MatrixRow,
  mwcActive: boolean,
): string {
  const hl = slice.highlights.length;

  if (hl === 0) {
    if (
      mwcActive &&
      evidence.boundHitCount === 0 &&
      evidence.serpHitCount >= SERP_BIND_FAILURE_THRESHOLD
    ) {
      return trimSummaryToMax(RETRIEVAL_BIND_FAILURE_SUMMARY);
    }
    if (row.dataSaturation === "sparse" && mwcActive) {
      return trimSummaryToMax(MWC_SPARSE_SUMMARY);
    }
    if (
      evidence.boundDisputeHitCount != null &&
      evidence.boundDisputeHitCount > 0 &&
      evidence.boundHitCount > 0
    ) {
      return trimSummaryToMax(BOUND_DISPUTE_SNIPPET_SUMMARY);
    }
    if (evidence.boundHitCount > 0 && evidence.llmHitCount > 0) {
      return trimSummaryToMax(BOUND_NO_HIGHLIGHT_SUMMARY);
    }
    if (row.dataSaturation === "unindexed") {
      if (OVERCONFIDENT_ZERO_EVIDENCE.test(slice.summaryZh)) {
        return trimSummaryToMax(UNINDEXED_SUMMARY);
      }
      return trimSummaryToMax(slice.summaryZh);
    }
    return trimSummaryToMax(slice.summaryZh);
  }

  if (OVERCONFIDENT_ZERO_EVIDENCE.test(slice.summaryZh)) {
    return trimSummaryToMax(UNINDEXED_SUMMARY);
  }
  return trimSummaryToMax(slice.summaryZh);
}

function licenseStatus(
  mwcMatched: boolean,
  mwcAmbiguous: boolean,
): Evaluation["complianceTrack"]["licenseStatus"] {
  if (mwcAmbiguous) return "ambiguous";
  if (mwcMatched) return "active";
  return "not_found";
}

/** DEC-0007 Appendix A — sole grade authority for reportVersion 2.2.0+. */
export function calibrateEvaluation(
  params: CalibrateEvaluationParams,
): CalibratedReportFields {
  const { slice, evidence, mwcMatched, mwcAmbiguous, generatedAt } = params;
  const highlights = slice.highlights;
  const mwcActive = mwcMatched && !mwcAmbiguous;

  const discussionCount =
    highlights.length === 0
      ? 0
      : Math.min(
          slice.discussionCount,
          highlights.length,
          evidence.llmHitCount,
        );

  const themes = stripNoDiscussionTheme(
    slice.themes,
    evidence,
    highlights.length,
  );

  const boundDispute = evidence.boundDisputeHitCount ?? 0;

  const row =
    highlights.length === 0
      ? matrixForZeroHighlights(
          mwcActive,
          evidence.boundHitCount,
          evidence.serpHitCount,
        )
      : matrixForHighlights(
          highlights,
          generatedAt,
          evidence.boundHitCount,
        );

  let confidence = row.confidence;
  if (evidence.llmHitCount > 0 && highlights.length === 0) {
    confidence = "low";
  }
  if (mwcAmbiguous && confidence !== "low") {
    confidence = "low";
  }

  const recentDisputeCount = ratedDisputeHighlights(
    highlights,
    generatedAt,
  ).length;

  const summaryZh = buildSummary(slice, evidence, row, mwcActive);

  const evaluation = applyRiskBandToEvaluation(
    {
      overallGrade: row.overallGrade,
      displayGradeZh: row.displayGradeZh,
      riskBandZh: "中性",
      confidence,
      dataSaturation: row.dataSaturation,
      complianceTrack: {
        isMwcRegistered: mwcActive,
        licenseStatus: licenseStatus(mwcMatched, mwcAmbiguous),
      },
      reputationTrack: {
        disputeLevel: row.disputeLevel,
        recentDisputeCount,
      },
    },
    {
      boundHitCount: evidence.boundHitCount,
      boundDisputeHitCount: boundDispute,
      boundPraiseHitCount: evidence.boundPraiseHitCount ?? 0,
      disputeLevel: row.disputeLevel,
      highlights,
      overallGrade: row.overallGrade,
      generatedAt,
    },
  );

  return {
    grade: row.overallGrade,
    confidence: evaluation.confidence,
    summaryZh,
    evaluation,
    themes,
    discussionCount,
  };
}
