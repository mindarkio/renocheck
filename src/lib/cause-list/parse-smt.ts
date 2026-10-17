import { extractRowCells, extractTableRows, parseDclListDate } from "./parse-html-utils";
import type { CauseListCourtCode, ParsedCauseListCase } from "./types";
import { splitPartyBlock } from "./party";

const COURT: CauseListCourtCode = "SMT";

export function parseSmtCauseListHtml(
  html: string,
  listDateDdMmYyyy: string,
): ParsedCauseListCase[] {
  const hearingDate = parseDclListDate(listDateDdMmYyyy);
  const cases: ParsedCauseListCase[] = [];

  for (const row of extractTableRows(html)) {
    const cells = extractRowCells(row);
    if (cells.length < 6) continue;
    const caseNo = cells[2]?.trim();
    if (!caseNo || !/^SCTC?\s/i.test(caseNo)) continue;

    const claimantBlock = cells[3] ?? "";
    const defendantBlock = cells[4] ?? "";
    const claimNature = cells[5]?.trim();
    const hearingType = cells[6]?.trim();

    const parties = [
      ...splitPartyBlock(claimantBlock, "claimant"),
      ...splitPartyBlock(defendantBlock, "defendant"),
    ];

    cases.push({
      court: COURT,
      caseNo,
      hearingDate,
      claimNature,
      hearingType,
      parties,
    });
  }

  return cases;
}
