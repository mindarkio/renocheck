import { extractCaseNosFromText, detectLegacyCaseFormat } from "./case-no";
import { assertPageListDate } from "./page-date";
import { extractRowCells, parseDclListDate } from "./parse-html-utils";
import { splitPartyBlock } from "./party";
import type { ParsedCauseListCase } from "./types";

export type SmtParseResult = {
  cases: ParsedCauseListCase[];
  rowCount: number;
  caseNoCount: number;
};

export function parseSmtCauseListHtml(
  html: string,
  listDateDdMmYyyy: string,
): SmtParseResult {
  assertPageListDate(html, listDateDdMmYyyy);
  if (detectLegacyCaseFormat(html)) {
    console.warn("cause_list: unsupported legacy case number format in page");
  }

  const hearingDate = parseDclListDate(listDateDdMmYyyy);
  const cases: ParsedCauseListCase[] = [];
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tm: RegExpExecArray | null;

  while ((tm = tableRe.exec(html)) !== null) {
    const tableHtml = tm[1];
    if (!/SCTC\s*\d/i.test(tableHtml)) continue;

    const rowMatch = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    if (!rowMatch) continue;

    const cells = extractRowCells(rowMatch[1]);
    if (cells.length < 6) continue;

    const caseNos = extractCaseNosFromText(cells[1]);
    if (caseNos.length === 0) continue;

    const caseNo = caseNos[0];
    const claimantBlock = cells[2] ?? "";
    const defendantBlock = cells[3] ?? "";
    const claimNature = cells[4]?.trim();
    const hearingType = cells[5]?.trim();

    cases.push({
      court: "SMT",
      caseNo,
      hearingDate,
      claimNature,
      hearingType,
      parties: [
        ...splitPartyBlock(claimantBlock, "claimant", { splitInlineAnd: false }),
        ...splitPartyBlock(defendantBlock, "defendant", { splitInlineAnd: false }),
      ],
    });
  }

  const caseNoCount = cases.length;
  return { cases, rowCount: caseNoCount, caseNoCount };
}

/** Count raw SCTC tables (for smoke). */
export function countSmtTables(html: string): number {
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let n = 0;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html)) !== null) {
    if (/SCTC\s*\d/i.test(tm[1])) n++;
  }
  return n;
}
