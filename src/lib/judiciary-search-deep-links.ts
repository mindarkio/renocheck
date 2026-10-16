import { buildLrsPartiesSearchResultUrl } from "./lrs-search-url";

/** Prefilled external search links (一撲即查); user leaves site to verify. */
export function buildJudiciaryDeepLinks(searchLabel: string) {
  const q = searchLabel.trim();
  const encoded = encodeURIComponent(q);
  return {
    lrsPartiesSearch: buildLrsPartiesSearchResultUrl(q),
    hkliiSearch: `https://v2.hklii.hk/search?q=${encoded}`,
    dailyCauseListSearch: `https://www.judiciary.hk/zh/court_services_facilities/daily_cause_list.html`,
    dailyCauseListNote:
      "排期表請於司法機構網站以公司／訴訟方名稱自行查閱；小額錢債審裁處多數裁決不刊憲。",
  };
}
