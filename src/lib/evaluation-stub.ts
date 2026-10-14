import type { z } from "zod";
import {
  type RiskReport,
  type confidenceSchema,
  type dataSaturationSchema,
  type evaluationSchema,
  type gradeSchema,
  type licenseStatusSchema,
} from "./report-schema";

type Grade = z.infer<typeof gradeSchema>;
type Confidence = z.infer<typeof confidenceSchema>;
type DataSaturation = z.infer<typeof dataSaturationSchema>;
type LicenseStatus = z.infer<typeof licenseStatusSchema>;
type Evaluation = z.infer<typeof evaluationSchema>;

/** P1 stub: mirrors calibrated top-level grade until calibration v2 (P5). DEC-0007 */
export function buildEvaluationStub(params: {
  overallGrade: Grade;
  confidence: Confidence;
  mwcMatched: boolean;
  mwcAmbiguous?: boolean;
  boundHitCount: number;
  highlightCount: number;
}): Evaluation {
  const {
    overallGrade,
    confidence,
    mwcMatched,
    mwcAmbiguous = false,
    boundHitCount,
    highlightCount,
  } = params;

  let licenseStatus: LicenseStatus = "not_found";
  if (mwcAmbiguous) licenseStatus = "ambiguous";
  else if (mwcMatched) licenseStatus = "active";

  let dataSaturation: DataSaturation = "unindexed";
  if (highlightCount >= 2) dataSaturation = "rich";
  else if (boundHitCount > 0) dataSaturation = "moderate";
  else if (mwcMatched) dataSaturation = "sparse";

  const disputeLevel =
    highlightCount === 0 ? "none_detected" : "historical_isolated";

  return {
    overallGrade,
    displayGradeZh: overallGrade,
    riskBandZh: boundHitCount === 0 ? "中性" : "風險中等",
    confidence,
    dataSaturation,
    complianceTrack: {
      isMwcRegistered: mwcMatched && !mwcAmbiguous,
      licenseStatus,
    },
    reputationTrack: {
      disputeLevel,
      recentDisputeCount: 0,
    },
  };
}

export function mirrorEvaluationConfidence(
  report: RiskReport,
  confidence: Confidence,
): RiskReport {
  return {
    ...report,
    confidence,
    evaluation: { ...report.evaluation, confidence },
  };
}
