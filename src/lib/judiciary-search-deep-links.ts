import { buildLrsPartiesSearchResultUrl } from "./lrs-search-url";
import {
  DAILY_CAUSE_LIST_HERO_NOTE_ZH,
  JUDICIARY_DAILY_CAUSE_LIST_URL,
} from "./report-trust-copy-zh";

export const JUDICIARY_DCL_SEARCH_ACTION =
  "https://e-services.judiciary.hk/dcl/search.jsp";

export function hktDateDdmmyyyy(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(now);
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const year = parts.find((p) => p.type === "year")?.value ?? "2000";
  return `${day}${month}${year}`;
}

export function buildDailyCauseListPostFields(
  partyName: string,
  now: Date,
): { lang: "tc"; date: string; mode: "search"; parties: string } {
  return {
    lang: "tc",
    date: hktDateDdmmyyyy(now),
    mode: "search",
    parties: partyName.trim().slice(0, 200),
  };
}

/** Prefilled external search links (一撲即查); user leaves site to verify. */
export function buildJudiciaryDeepLinks(searchLabel: string) {
  const q = searchLabel.trim();
  const encoded = encodeURIComponent(q);
  return {
    lrsPartiesSearch: buildLrsPartiesSearchResultUrl(q),
    hkliiSearch: `https://www.hklii.hk/search?q=${encoded}`,
    dailyCauseListSearch: JUDICIARY_DAILY_CAUSE_LIST_URL,
    dailyCauseListAction: JUDICIARY_DCL_SEARCH_ACTION,
    dailyCauseListNote: DAILY_CAUSE_LIST_HERO_NOTE_ZH,
  };
}
