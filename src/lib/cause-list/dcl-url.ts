export const CAUSE_LIST_USER_AGENT =
  "RenocheckCauseListResearch/0.1 (+https://renocheck.homes; offline parser dev)";

export const CAUSE_LIST_MIN_DELAY_MS = 3000;
export const CAUSE_LIST_MAX_DELAY_MS = 5000;

export const DCL_LIVE_ORIGIN = "https://e-services.judiciary.hk";

/** Live Daily Cause List URL. Pathname is `/dcl/view.jsp`. */
export function buildDclLiveUrl(dateDdMmYyyy: string, court: string): string {
  return `${DCL_LIVE_ORIGIN}/dcl/view.jsp?lang=en&date=${dateDdMmYyyy}&court=${court}`;
}

/** Wayback raw capture (`id_`), no toolbar rewrite. */
export function buildWaybackRawUrl(timestamp: string, originalUrl: string): string {
  return `https://web.archive.org/web/${timestamp}id_/${originalUrl}`;
}

export function causeListPoliteDelayMs(rand = Math.random()): number {
  const span = CAUSE_LIST_MAX_DELAY_MS - CAUSE_LIST_MIN_DELAY_MS;
  return CAUSE_LIST_MIN_DELAY_MS + Math.floor(rand * (span + 1));
}

/**
 * CDX query for every archived view.jsp capture in the window.
 * Court is filtered client-side: a server filter on `court=DC` also misses or
 * over-matches, and URLSearchParams encoding drops these rows.
 */
export function buildCdxSearchUrl(fromCompact: string, toCompact: string): string {
  return (
    "https://web.archive.org/cdx/search/cdx?url=e-services.judiciary.hk/dcl/view.jsp" +
    "&matchType=prefix" +
    `&from=${fromCompact}&to=${toCompact}` +
    "&output=json&fl=timestamp,original,statuscode&filter=statuscode:200"
  );
}
