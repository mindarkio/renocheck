/**
 * LRS advanced search URL builder (Track 1 D1).
 * Params validated in browser on legalref.judiciary.hk — see docs/design/lrs-judgment-discovery-rules.md
 */

export type LrsSearchMode = "anywords" | "phrase" | "anyorder";

const TXTSELECTOPT: Record<LrsSearchMode, string> = {
  anywords: "1",
  phrase: "3",
  anyorder: "2",
};

export type LrsDatabase = "JU" | "RV" | "RS" | "PD";

export type LrsSearchUrlOptions = {
  keyword: string;
  mode?: LrsSearchMode;
  databases?: LrsDatabase[];
  stem?: boolean;
  /** When set, omit selallct=1 and pass selSchct (court level filter). Experimental — verify in browser. */
  courtLevel?: "FA" | "CA" | "HC" | "CT" | "DC" | "FC" | "LD" | "OT";
};

const DEFAULT_DATABASES: LrsDatabase[] = ["JU"];

export function buildLrsSearchResultUrl(options: LrsSearchUrlOptions): string {
  const {
    keyword,
    mode = "anywords",
    databases = DEFAULT_DATABASES,
    stem = true,
    courtLevel,
  } = options;

  const params = new URLSearchParams({
    stem: stem ? "1" : "0",
    txtselectopt: TXTSELECTOPT[mode],
    txtSearch: keyword,
    selall: "1",
    isadvsearch: "1",
  });

  if (courtLevel) {
    params.append("selSchct", courtLevel);
  } else {
    params.set("selallct", "1");
  }

  for (const db of databases) {
    params.append("selDatabase", db);
  }

  return `https://legalref.judiciary.hk/lrs/common/search/search_result.jsp?${params.toString()}`;
}

/** Advanced search: `txtSearch` + `txtSearch2` (e.g. DCCJ + 裝修 in parties/full text). */
export type LrsDualFieldSearchUrlOptions = {
  txtSearch: string;
  txtSearch2: string;
  txtselectopt?: "1" | "2" | "3";
  txtselectopt2?: "1" | "2" | "3";
  databases?: LrsDatabase[];
  stem?: boolean;
};

export function buildLrsDualFieldSearchResultUrl(
  options: LrsDualFieldSearchUrlOptions,
): string {
  const {
    txtSearch,
    txtSearch2,
    txtselectopt = "1",
    txtselectopt2 = "1",
    databases = DEFAULT_DATABASES,
    stem = true,
  } = options;

  const params = new URLSearchParams({
    stem: stem ? "1" : "0",
    txtselectopt,
    txtSearch,
    txtselectopt2,
    txtSearch2,
    selall: "1",
    isadvsearch: "1",
    selallct: "1",
  });

  for (const db of databases) {
    params.append("selDatabase", db);
  }

  return `https://legalref.judiciary.hk/lrs/common/search/search_result.jsp?${params.toString()}`;
}

/** Parties field search (`txtselectopt=7` = Parties of Judgment; browser-verified 2026-10-16). */
export function buildLrsPartiesSearchResultUrl(partyName: string): string {
  const keyword = partyName.trim();
  const params = new URLSearchParams({
    stem: "1",
    isadvsearch: "1",
    selall: "1",
    selallct: "1",
    txtselectopt: "7",
    txtSearch: keyword,
  });
  params.append("selDatabase", "JU");
  return `https://legalref.judiciary.hk/lrs/common/search/search_result.jsp?${params.toString()}`;
}

/** Case number search (`txtselectopt=4` = Case Number of Judgment). */
export function buildLrsCaseNumberSearchResultUrl(caseRef: string): string {
  const normalized = caseRef.replace(/\s+/g, "").trim();
  const params = new URLSearchParams({
    stem: "1",
    isadvsearch: "1",
    selall: "1",
    selallct: "1",
    txtselectopt: "4",
    txtSearch: normalized,
  });
  params.append("selDatabase", "JU");
  return `https://legalref.judiciary.hk/lrs/common/search/search_result.jsp?${params.toString()}`;
}
