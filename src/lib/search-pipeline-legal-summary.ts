import { LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX } from "./legal-event-display";

const SUMMARY_ZH_MAX = 120;
const MUST_KEEP_PHRASE = "建議自行核實";

function stripMisleadingRiskBandPhrase(summaryZh: string): string {
  return summaryZh
    .replaceAll("未見負面摘要", "")
    .replace(/[，,]{2,}/g, "，")
    .replace(/^[，,\s]+|[，,\s]+$/g, "")
    .trim();
}

function codeUnitLength(text: string): number {
  return Array.from(text).length;
}

function sliceByCodeUnits(text: string, maxUnits: number): string {
  return Array.from(text).slice(0, maxUnits).join("");
}

/** Truncate on code-unit count; prefer 。 boundaries; never split MUST_KEEP_PHRASE. */
export function truncateSummaryZh(text: string, maxUnits: number): string {
  if (codeUnitLength(text) <= maxUnits) return text;

  const phraseIndex = text.indexOf(MUST_KEEP_PHRASE);
  if (phraseIndex >= 0) {
    const phraseEnd = phraseIndex + MUST_KEEP_PHRASE.length;
    const phraseEndUnits = codeUnitLength(text.slice(0, phraseEnd));
    if (phraseEndUnits > maxUnits) {
      const beforePhrase = text.slice(0, phraseIndex).trimEnd();
      return truncateSummaryZh(beforePhrase, maxUnits);
    }
  }

  let window = sliceByCodeUnits(text, maxUnits);
  if (phraseIndex >= 0) {
    const phraseEnd = phraseIndex + MUST_KEEP_PHRASE.length;
    if (phraseIndex < window.length && phraseEnd > window.length) {
      window = text.slice(0, phraseIndex).trimEnd();
    }
  }

  const lastPeriod = window.lastIndexOf("。");
  if (lastPeriod >= 0) {
    return window.slice(0, lastPeriod + 1);
  }
  return window;
}

/** Prepend degraded hint and strip misleading「未見負面摘要」from summary text. */
export function summaryZhForLegalLookupDegraded(summaryZh: string): string {
  const body = stripMisleadingRiskBandPhrase(summaryZh);
  if (body.startsWith(LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX)) {
    return truncateSummaryZh(body, SUMMARY_ZH_MAX);
  }
  const combined = body
    ? `${LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX}${body}`
    : LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX;
  return truncateSummaryZh(combined, SUMMARY_ZH_MAX);
}
