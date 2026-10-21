import type { z } from "zod";
import type {
  discussionHighlightSchema,
  disputeLevelSchema,
  evaluationSchema,
  gradeSchema,
  riskBandZhSchema,
  RiskReport,
} from "./report-schema";
import {
  highlightSuggestsDispute,
  meetsHighRiskDisputeEvidence,
  ratedDisputeHighlights,
} from "./dispute-signals";

type Grade = z.infer<typeof gradeSchema>;
type Evaluation = z.infer<typeof evaluationSchema>;
type RiskBandZh = z.infer<typeof riskBandZhSchema>;
type DisputeLevel = z.infer<typeof disputeLevelSchema>;
type Highlight = z.infer<typeof discussionHighlightSchema>;

export type ResolveRiskBandInput = {
  boundHitCount: number;
  boundDisputeHitCount: number;
  boundPraiseHitCount: number;
  disputeLevel: DisputeLevel;
  highlights: Highlight[];
  overallGrade: Grade;
  generatedAt: string;
};

export type ResolvedRiskBand = {
  riskBandZh: RiskBandZh;
  riskBandDetailZh?: string;
};

const RISK_BAND_MAX_VALUES = new Set<RiskBandZh>(["風險中等", "中性"]);

const BAND_SEVERITY: Record<RiskBandZh, number> = {
  風險偏高: 3,
  風險中等: 2,
  中性: 1,
  未見負面摘要: 0,
};

/** Server env emergency cap (see `.env.example`). */
export function capRiskBandZh(band: RiskBandZh): RiskBandZh {
  const raw = process.env.RISK_BAND_MAX?.trim();
  if (!raw || !RISK_BAND_MAX_VALUES.has(raw as RiskBandZh)) return band;
  const cap = raw as RiskBandZh;
  return BAND_SEVERITY[band] > BAND_SEVERITY[cap] ? cap : band;
}

/** DEC-0010 — user-facing band; bound=0 always 中性. */
export function resolveRiskBandZh(input: ResolveRiskBandInput): ResolvedRiskBand {
  const {
    boundHitCount,
    boundPraiseHitCount,
    disputeLevel,
    highlights,
    overallGrade,
    generatedAt,
  } = input;

  if (boundHitCount === 0) {
    return { riskBandZh: "中性" };
  }

  const ratedCount = ratedDisputeHighlights(highlights, generatedAt).length;
  const highlightDispute = highlights.some(highlightSuggestsDispute);
  const hasDispute =
    highlightDispute ||
    disputeLevel === "active_concerning" ||
    disputeLevel === "severe" ||
    disputeLevel === "historical_isolated";

  if (ratedCount === 0 && disputeLevel === "none_detected") {
    if (
      boundPraiseHitCount >= 1 &&
      !highlightDispute
    ) {
      return {
        riskBandZh: "未見負面摘要",
        ...(boundPraiseHitCount === 1
          ? { riskBandDetailZh: "公開讚揚較少" }
          : {}),
      };
    }
    return { riskBandZh: "中性" };
  }

  if (
    disputeLevel === "severe" ||
    overallGrade === "F" ||
    overallGrade === "E" ||
    meetsHighRiskDisputeEvidence(highlights, generatedAt)
  ) {
    return { riskBandZh: capRiskBandZh("風險偏高") };
  }

  if (overallGrade === "D" && hasDispute && ratedCount > 0) {
    return { riskBandZh: capRiskBandZh("風險偏高") };
  }

  if (hasDispute && ratedCount > 0) {
    return { riskBandZh: capRiskBandZh("風險中等") };
  }

  if (boundPraiseHitCount >= 1 && !highlightDispute) {
    return {
      riskBandZh: "未見負面摘要",
      ...(boundPraiseHitCount === 1
        ? { riskBandDetailZh: "公開讚揚較少" }
        : {}),
    };
  }

  return { riskBandZh: "中性" };
}

export function applyRiskBandMaxCapToReport(report: RiskReport): RiskReport {
  const capped = capRiskBandZh(report.evaluation.riskBandZh);
  if (capped === report.evaluation.riskBandZh) return report;
  return {
    ...report,
    evaluation: {
      ...report.evaluation,
      riskBandZh: capped,
    },
  };
}

export function applyRiskBandToEvaluation(
  evaluation: Evaluation,
  input: ResolveRiskBandInput,
): Evaluation {
  const band = resolveRiskBandZh(input);
  let confidence = evaluation.confidence;
  if (band.riskBandZh === "未見負面摘要" && band.riskBandDetailZh) {
    confidence = "low";
  }
  const riskBandZh = capRiskBandZh(band.riskBandZh);
  return {
    ...evaluation,
    ...band,
    riskBandZh,
    confidence,
  };
}
