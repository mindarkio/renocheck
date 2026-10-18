import { buildLrsPartiesSearchResultUrl } from "./lrs-search-url";
import {
  DAILY_CAUSE_LIST_HERO_NOTE_ZH,
  JUDICIARY_DAILY_CAUSE_LIST_URL,
} from "./report-trust-copy-zh";

/** Prefilled external search links (一撲即查); user leaves site to verify. */
export function buildJudiciaryDeepLinks(searchLabel: string) {
  const q = searchLabel.trim();
  const encoded = encodeURIComponent(q);
  return {
    lrsPartiesSearch: buildLrsPartiesSearchResultUrl(q),
    hkliiSearch: `https://v2.hklii.hk/search?q=${encoded}`,
    dailyCauseListSearch: JUDICIARY_DAILY_CAUSE_LIST_URL,
    dailyCauseListNote: DAILY_CAUSE_LIST_HERO_NOTE_ZH,
  };
}
