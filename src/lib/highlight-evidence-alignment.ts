import type { DiscussionHighlight } from "./report-schema";
import type { RiskReport } from "./report-schema";
import { mirrorEvaluationConfidence } from "./evaluation-stub";

/** M2: highlights may only cite URLs present in L1-bound hits (retrievalEvidence). */
export function filterHighlightsToAllowedUrls(
  highlights: DiscussionHighlight[],
  allowedUrls: ReadonlySet<string>,
): { highlights: DiscussionHighlight[]; dropped: number } {
  const kept = highlights.filter((h) => allowedUrls.has(h.url));
  return {
    highlights: kept,
    dropped: highlights.length - kept.length,
  };
}

export function enforceHighlightEvidenceAlignment(
  report: RiskReport,
  allowedUrls: ReadonlySet<string>,
): RiskReport {
  const raw = report.signals.highlights ?? [];
  const { highlights, dropped } = filterHighlightsToAllowedUrls(
    raw,
    allowedUrls,
  );
  if (dropped === 0) return report;

  const patched = mirrorEvaluationConfidence(report, "low");
  return {
    ...patched,
    signals: {
      ...patched.signals,
      highlights,
      discussionCount: highlights.length,
    },
  };
}
