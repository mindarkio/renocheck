import { LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX } from "./legal-event-display";

const SUMMARY_ZH_MAX = 120;

/** Prepend degraded hint and strip misleading「未見負面摘要」from summary text. */
export function summaryZhForLegalLookupDegraded(summaryZh: string): string {
  const body = summaryZh.replaceAll("未見負面摘要", "中性");
  if (body.startsWith(LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX)) {
    return body.slice(0, SUMMARY_ZH_MAX);
  }
  const combined = `${LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX}${body}`;
  return combined.slice(0, SUMMARY_ZH_MAX);
}
