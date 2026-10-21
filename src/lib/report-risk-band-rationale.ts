import { ratedDisputeHighlights } from "./dispute-signals";
import type { RiskReport } from "./report-schema";

/** N in hero「依據」line — deduped dispute highlights that count toward rating. */
export function ratedDisputeHighlightCount(report: RiskReport): number {
  const titles = Object.fromEntries(
    (report.signals.retrievalEvidence ?? []).map((e) => [e.url, e.title]),
  );
  return ratedDisputeHighlights(
    report.signals.highlights ?? [],
    report.generatedAt,
    titles,
  ).length;
}

/** Aaron-approved copy; do not edit wording. */
export function riskBandRationaleLineZh(n: number): string {
  return `依據：${n} 則公開來源提及付款／工程質素／延誤糾紛`;
}
