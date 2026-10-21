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
  type SourceTitleByUrl,
} from "./dispute-signals";
import { computeLegalFloors } from "./legal-event-calibration";

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
  sourceTitles?: SourceTitleByUrl;
};

export type ResolvedRiskBand = {
  riskBandZh: RiskBandZh;
  riskBandDetailZh?: string;
};

const RISK_BAND_MAX_VALUES = new Set<RiskBandZh>(["風險中等", "中性"]);

let warnedInvalidCap = false;

const BAND_SEVERITY: Record<RiskBandZh, number> = {
  風險偏高: 3,
  風險中等: 2,
  中性: 1,
  未見負面摘要: 0,
};

/** Server env emergency cap (see `.env.example`). */
export function capRiskBandZh(band: RiskBandZh): RiskBandZh {
  const raw = process.env.RISK_BAND_MAX?.trim();
  if (raw && !RISK_BAND_MAX_VALUES.has(raw as RiskBandZh)) {
    if (!warnedInvalidCap) {
      warnedInvalidCap = true;
      console.warn(JSON.stringify({ event: "risk_band_max_invalid" }));
    }
    return band;
  }
  if (!raw) return band;
  const cap = raw as RiskBandZh;
  return BAND_SEVERITY[band] > BAND_SEVERITY[cap] ? cap : band;
}

/** DEC-0010 — user-facing band; bound=0 always 中性. */
export function resolveRiskBandZh(input: ResolveRiskBandInput): ResolvedRiskBand {
  const {
    boundHitCount,
    boundDisputeHitCount,
    boundPraiseHitCount,
    disputeLevel,
    highlights,
    overallGrade,
    generatedAt,
    sourceTitles,
  } = input;

  if (boundHitCount === 0) {
    return { riskBandZh: "中性" };
  }

  const ratedCount = ratedDisputeHighlights(highlights, generatedAt, sourceTitles).length;
  const highlightDispute = highlights.some(highlightSuggestsDispute);
  const hasDispute =
    highlightDispute ||
    disputeLevel === "active_concerning" ||
    disputeLevel === "severe" ||
    disputeLevel === "historical_isolated";

  if (ratedCount === 0 && disputeLevel === "none_detected") {
    if (
      boundPraiseHitCount >= 1 &&
      boundDisputeHitCount === 0 &&
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
    meetsHighRiskDisputeEvidence(highlights, generatedAt, sourceTitles)
  ) {
    return { riskBandZh: "風險偏高" };
  }

  if (overallGrade === "D" && hasDispute && ratedCount > 0) {
    return { riskBandZh: "風險偏高" };
  }

  if (hasDispute && ratedCount > 0) {
    return { riskBandZh: "風險中等" };
  }

  if (boundPraiseHitCount >= 1 && boundDisputeHitCount === 0 && !highlightDispute) {
    return {
      riskBandZh: "未見負面摘要",
      ...(boundPraiseHitCount === 1
        ? { riskBandDetailZh: "公開讚揚較少" }
        : {}),
    };
  }

  return { riskBandZh: "中性" };
}

/** Serve-time only (pipeline response + cache read); the cached report stays uncapped. */
export function applyRiskBandMaxCapToReport(report: RiskReport): RiskReport {
  let capped = capRiskBandZh(report.evaluation.riskBandZh);
  if (capped === report.evaluation.riskBandZh) return report;
  // Judgment floor: the cap may lower 偏高 → 中等, but never below 風險中等 when a judgment floor applies.
  const floors = computeLegalFloors(
    report.official.legalEvents ?? [],
    report.signals.boundHitCount ?? 0,
    report.generatedAt,
  );
  if (floors && BAND_SEVERITY[floors.riskBandZh] >= BAND_SEVERITY["風險中等"] && BAND_SEVERITY[capped] < BAND_SEVERITY["風險中等"]) {
    capped = "風險中等";
  }
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
  return {
    ...evaluation,
    ...band,
    confidence,
  };
}
