import type { RiskBandZh } from "./risk-band-display";
import type { RiskReport } from "./report-schema";
import { isReportLegalLookupDegraded } from "./search-cache";

export { isReportLegalLookupDegraded };

export function reportCardHeaderRiskBandZh(report: RiskReport): RiskBandZh {
  if (
    isReportLegalLookupDegraded(report) &&
    report.evaluation.riskBandZh === "未見負面摘要"
  ) {
    return "中性";
  }
  return report.evaluation.riskBandZh;
}

export function reportCardHeaderBandLabel(report: RiskReport): string {
  const bandDetail = report.evaluation.riskBandDetailZh;
  if (
    isReportLegalLookupDegraded(report) &&
    report.evaluation.riskBandZh === "未見負面摘要"
  ) {
    return reportCardHeaderRiskBandZh(report);
  }
  return bandDetail ?? report.evaluation.riskBandZh;
}

export function reportCardShowRiskBandFooterNote(report: RiskReport): boolean {
  return (
    report.evaluation.riskBandZh === "未見負面摘要" &&
    !isReportLegalLookupDegraded(report)
  );
}

export function reportCardShowFooterNotes(
  report: RiskReport,
  highlightCount: number,
): boolean {
  return (
    (report.confidence === "medium" && highlightCount === 1) ||
    reportCardShowRiskBandFooterNote(report)
  );
}
