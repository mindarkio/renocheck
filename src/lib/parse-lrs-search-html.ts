/**
 * Parse LRS advanced search result HTML (search_result.jsp).
 * See docs/design/lrs-judgment-discovery-rules.md
 */

const LRS_SEARCH_BASE = "https://legalref.judiciary.hk/lrs/common/search/";

export type LrsSearchResultMeta = {
  resultCount: number | null;
  totalPages: number | null;
};

export type LrsSearchResultRow = {
  caseRef: string;
  eventDate: string;
  partiesLine: string;
  neutralCitation?: string;
  database: string;
  judgmentDetailQuery?: string;
};

function parseDdMmYyyyToIso(value: string): string | null {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

export function parseLrsSearchResultMeta(html: string): LrsSearchResultMeta {
  const text = htmlToPlainText(html);
  const countM = text.match(/Result:\s*([\d,]+)\s*found/i);
  const pagesM = text.match(/Total\s+Pages:\s*([\d,]+)/i);
  return {
    resultCount: countM
      ? Number.parseInt(countM[1].replace(/,/g, ""), 10)
      : null,
    totalPages: pagesM
      ? Number.parseInt(pagesM[1].replace(/,/g, ""), 10)
      : null,
  };
}

function buildJudgmentUrl(detailQuery: string | undefined): string | undefined {
  if (!detailQuery) return undefined;
  const q = detailQuery.startsWith("?") ? detailQuery.slice(1) : detailQuery;
  return `${LRS_SEARCH_BASE}search_result_detail_frame.jsp?${q}`;
}

function extractParties(block: string): string {
  const afterDb = block.split(/Database:\s*<\/span>/i)[0];
  const partyMatch = afterDb.match(
    /col-md-12\s+pl-1">\s*([^<]+?)\s*<\/div>/i,
  );
  if (!partyMatch) return "";
  return partyMatch[1].replace(/\s+/g, " ").trim();
}

export function parseLrsSearchResultHtml(html: string): LrsSearchResultRow[] {
  const rows: LrsSearchResultRow[] = [];
  const blocks = html.split(/<tr\s+data-index="/i).slice(1);

  for (const block of blocks) {
    const caseMatch = block.match(
      /class="searchfont result-caseno"[^>]*>\s*<u>([^<]+)<\/u>/i,
    );
    if (!caseMatch) continue;
    const caseRef = caseMatch[1].replace(/\s+/g, " ").trim();

    const disMatch = block.match(/temp\d+='([^']+)'/i);
    const detailQuery = disMatch?.[1];

    const dateMatch = block.match(
      /Date<\/span>:\s*(\d{2}\/\d{2}\/\d{4})/i,
    );
    const isoDate = dateMatch ? parseDdMmYyyyToIso(dateMatch[1]) : null;
    if (!isoDate) continue;

    const citationMatch = block.match(
      /\[\d{4}\]\s+HK[A-Z]+\s+\d+/i,
    );
    const neutralCitation = citationMatch?.[0];

    const dbMatch = block.match(/Database:\s*<\/span>\s*([^<\n]+)/i);
    const database = dbMatch?.[1].trim() ?? "";

    const partiesLine = extractParties(block);
    if (!partiesLine) continue;

    rows.push({
      caseRef,
      eventDate: isoDate,
      partiesLine,
      neutralCitation,
      database,
      judgmentDetailQuery: detailQuery,
    });
  }

  return rows;
}

export function lrsRowToCandidateFields(
  row: LrsSearchResultRow,
  ctx: {
    lrsListingUrl: string;
    profileId: string;
    tier: string;
    fetchedAt: string;
  },
) {
  return {
    caseRef: row.caseRef,
    eventDate: row.eventDate,
    partiesLine: row.partiesLine,
    neutralCitation: row.neutralCitation,
    database: row.database,
    lrsListingUrl: ctx.lrsListingUrl,
    judgmentUrl: buildJudgmentUrl(row.judgmentDetailQuery),
    discoveredFrom: { profileId: ctx.profileId, tier: ctx.tier },
    fetchedAt: ctx.fetchedAt,
  };
}
