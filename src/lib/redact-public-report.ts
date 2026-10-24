import { redactFeedbackComment } from "@/lib/feedback/redact";
import type {
  ActionableClause,
  DiscussionHighlight,
  RetrievalEvidenceItem,
  RiskReport,
} from "@/lib/report-schema";

/**
 * Length caps match `report-schema.ts`. The shared redactor also stops at 500
 * characters; these clamps keep a name-dense field inside the schema max.
 */
const SUMMARY_MAX = 120;
const HIGHLIGHT_SUMMARY_MAX = 160;
const FACT_SUMMARY_MAX = 160;
const SOURCE_NAME_MAX = 60;
const DATE_HINT_MAX = 40;
const EVIDENCE_TITLE_MAX = 200;
const EVIDENCE_SNIPPET_MAX = 280;
const MATCHED_TOKEN_MAX = 80;
/** `redactFeedbackComment` already stops at 500. Themes and deprecated snippets have no tighter schema max. */
const REDACTOR_MAX = 500;
const CLAUSE_CATEGORY_MAX = 40;
const CLAUSE_TEXT_MAX = 200;
const CLAUSE_REASON_MAX = 120;

function redactFreeText(value: string, maxLength: number): string {
  const redacted = redactFeedbackComment(value);
  return redacted.length <= maxLength ? redacted : redacted.slice(0, maxLength);
}

function redactHighlight(item: DiscussionHighlight): DiscussionHighlight {
  return {
    ...item,
    summaryZh: redactFreeText(item.summaryZh, HIGHLIGHT_SUMMARY_MAX),
    ...(item.factSummary !== undefined
      ? { factSummary: redactFreeText(item.factSummary, FACT_SUMMARY_MAX) }
      : {}),
    ...(item.sourceName !== undefined
      ? { sourceName: redactFreeText(item.sourceName, SOURCE_NAME_MAX) }
      : {}),
    ...(item.dateHint !== undefined
      ? { dateHint: redactFreeText(item.dateHint, DATE_HINT_MAX) }
      : {}),
  };
}

function redactEvidence(item: RetrievalEvidenceItem): RetrievalEvidenceItem {
  return {
    ...item,
    title: redactFreeText(item.title, EVIDENCE_TITLE_MAX),
    snippetExcerpt: redactFreeText(item.snippetExcerpt, EVIDENCE_SNIPPET_MAX),
    matchedToken: redactFreeText(item.matchedToken, MATCHED_TOKEN_MAX),
  };
}

function redactClause(item: ActionableClause): ActionableClause {
  return {
    category: redactFreeText(item.category, CLAUSE_CATEGORY_MAX),
    clauseText: redactFreeText(item.clauseText, CLAUSE_TEXT_MAX),
    reason: redactFreeText(item.reason, CLAUSE_REASON_MAX),
  };
}

/**
 * Public body of `POST /api/search` and `GET /api/report/[fingerprint]`.
 *
 * Runs at serialization. `search_cache.report` stays as stored so admin
 * company-name reads stay unchanged, and an existing row is redacted when
 * it is served. Registry identity fields stay as stored (DEC-0011).
 */
export function redactReportForPublicResponse(report: RiskReport): RiskReport {
  const premium = report.premium;
  return {
    ...report,
    summaryZh: redactFreeText(report.summaryZh, SUMMARY_MAX),
    signals: {
      ...report.signals,
      themes: report.signals.themes.map((theme) =>
        redactFreeText(theme, REDACTOR_MAX),
      ),
      highlights: report.signals.highlights?.map(redactHighlight),
      retrievalEvidence: report.signals.retrievalEvidence.map(redactEvidence),
      actionableClauses: report.signals.actionableClauses.map(redactClause),
    },
    ...(premium
      ? {
          premium: {
            ...premium,
            discussionSnippets: premium.discussionSnippets.map((item) => ({
              ...item,
              title: redactFreeText(item.title, REDACTOR_MAX),
              excerpt: redactFreeText(item.excerpt, REDACTOR_MAX),
            })),
          },
        }
      : {}),
  };
}
