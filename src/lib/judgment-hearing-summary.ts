/** Hearing summary placeholders — UI shows facts + links only until verified source. */

import type { HearingPointsSource } from "./legal-event-schema";

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

/** Whether to hide hearing points and show facts-only block. */
export function hearingSummaryPendingForEvent(
  points: string[],
  hearingPointsSource?: HearingPointsSource,
): boolean {
  if (hearingPointsSource === "ai_verified" || hearingPointsSource === "manual") {
    return points.length === 0;
  }
  if (points.length === 0) return true;
  return points.every((p) => isHearingSummaryPlaceholder(p));
}

export type LegalEventReviewStatus = "auto" | "human_verified";
