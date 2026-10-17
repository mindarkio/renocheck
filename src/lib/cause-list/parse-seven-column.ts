import { extractCaseNosFromText } from "./case-no";
import { assertPageListDate } from "./page-date";
import {
  extractRowCells,
  extractTableRows,
  parseDclListDate,
} from "./parse-html-utils";
import { parsePartyCell, type PartyCellMode } from "./parse-parties";
import type { CauseListCourtCode, ParsedCauseListCase } from "./types";
import { detectLegacyCaseFormat } from "./case-no";

export type SevenColumnParseResult = {
  cases: ParsedCauseListCase[];
  rowCount: number;
  caseNoCount: number;
};

export function parseSevenColumnCauseListHtml(
  html: string,
  listDateDdMmYyyy: string,
  court: CauseListCourtCode,
  partyMode: PartyCellMode,
): SevenColumnParseResult {
  assertPageListDate(html, listDateDdMmYyyy);
  if (detectLegacyCaseFormat(html)) {
    console.warn("cause_list: unsupported legacy case number format in page");
  }

  const hearingDate = parseDclListDate(listDateDdMmYyyy);
  const cases: ParsedCauseListCase[] = [];
  let rowCount = 0;
  let caseNoCount = 0;

  for (const rowHtml of extractTableRows(html)) {
    const cells = extractRowCells(rowHtml);
    if (cells.length < 7) continue;

    const caseNos = extractCaseNosFromText(cells[3]);
    if (caseNos.length === 0) continue;

    rowCount += 1;
    caseNoCount += caseNos.length;

    const parties = parsePartyCell(cells[4], partyMode);
    const claimNature = cells[5]?.trim();
    const hearingType = cells[6]?.trim();

    for (const caseNo of caseNos) {
      cases.push({
        court,
        caseNo,
        hearingDate,
        claimNature,
        hearingType,
        parties,
      });
    }
  }

  return { cases, rowCount, caseNoCount };
}
