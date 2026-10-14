import type { z } from "zod";
import type {
  discussionHighlightSchema,
  disputeLevelSchema,
  evaluationSchema,
  gradeSchema,
  riskBandZhSchema,
} from "./report-schema";

type Grade = z.infer<typeof gradeSchema>;
type Evaluation = z.infer<typeof evaluationSchema>;
type RiskBandZh = z.infer<typeof riskBandZhSchema>;
type DisputeLevel = z.infer<typeof disputeLevelSchema>;
type Highlight = z.infer<typeof discussionHighlightSchema>;

const DISPUTE_IN_TEXT =
  /超支|爛尾|糾紛|投訴|苦主|溝通|工程質素|中伏|拖工|走數|爭議/;

function highlightSuggestsDispute(h: Highlight): boolean {
  if (h.incidentType && h.incidentType !== "other") return true;
  const blob = `${h.summaryZh} ${h.factSummary ?? ""}`;
  return DISPUTE_IN_TEXT.test(blob);
}

export type ResolveRiskBandInput = {
  boundHitCount: number;
  boundDisputeHitCount: number;
  boundPraiseHitCount: number;
  disputeLevel: DisputeLevel;
  highlights: Highlight[];
  overallGrade: Grade;
};

export type ResolvedRiskBand = {
  riskBandZh: RiskBandZh;
  riskBandDetailZh?: string;
};

/** DEC-0010 — user-facing band; bound=0 always 中性. */
export function resolveRiskBandZh(input: ResolveRiskBandInput): ResolvedRiskBand {
  const {
    boundHitCount,
    boundDisputeHitCount,
    boundPraiseHitCount,
    disputeLevel,
    highlights,
    overallGrade,
  } = input;

  if (boundHitCount === 0) {
    return { riskBandZh: "中性" };
  }

  const highlightDispute = highlights.some(highlightSuggestsDispute);
  const hasDispute =
    boundDisputeHitCount > 0 ||
    highlightDispute ||
    disputeLevel === "active_concerning" ||
    disputeLevel === "severe" ||
    disputeLevel === "historical_isolated";

  if (
    disputeLevel === "severe" ||
    overallGrade === "F" ||
    overallGrade === "E" ||
    boundDisputeHitCount >= 3
  ) {
    return { riskBandZh: "風險偏高" };
  }

  if (overallGrade === "D" && hasDispute) {
    return { riskBandZh: "風險偏高" };
  }

  if (hasDispute) {
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
