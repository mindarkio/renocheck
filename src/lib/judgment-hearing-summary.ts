/** Hearing summary placeholders — UI shows facts + links only until human_verified. */

export const HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH =
  "聆訊要點待人手覆核；請以刊憲連結查閱公開紀錄。";

const PLACEHOLDER_MARKERS =
  /D2 自動摘要|待人手覆核|聆訊要點待人手覆核/i;

export function isHearingSummaryPlaceholder(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t === HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH) return true;
  return PLACEHOLDER_MARKERS.test(t);
}

export function hearingSummaryPendingForEvent(
  points: string[],
  reviewStatus?: "auto" | "human_verified",
): boolean {
  if (reviewStatus === "human_verified") return false;
  if (points.length === 0) return true;
  return points.every((p) => isHearingSummaryPlaceholder(p));
}

export type LegalEventReviewStatus = "auto" | "human_verified";
