import { extractRowCells, extractTableRows, parseDclListDate } from "./parse-html-utils";
import type { CauseListCourtCode, ParsedCauseListCase } from "./types";
import { splitPartyBlock } from "./party";

const COURT: CauseListCourtCode = "CACFI";

function extractPartiesFromCell(cell: string): {
  plaintiffs: string;
  defendants: string;
} {
  const text = cell.replace(/\r/g, "");
  const plaintiffMatch = text.match(
    /Plaintiff\(s\)\s*[:：]?\s*([\s\S]*?)(?=Defendant\(s\)|$)/i,
  );
  const defendantMatch = text.match(/Defendant\(s\)\s*[:：]?\s*([\s\S]*?)$/i);
  return {
    plaintiffs: plaintiffMatch?.[1]?.trim() ?? "",
    defendants: defendantMatch?.[1]?.trim() ?? "",
  };
}

export function parseCacfiCauseListHtml(
  html: string,
  listDateDdMmYyyy: string,
): ParsedCauseListCase[] {
  const hearingDate = parseDclListDate(listDateDdMmYyyy);
  const cases: ParsedCauseListCase[] = [];

  for (const row of extractTableRows(html)) {
    const cells = extractRowCells(row);
    if (cells.length < 4) continue;
    const caseNo = cells[2]?.trim();
    if (!caseNo || !/^HC/i.test(caseNo)) continue;

    const partyCell = cells[3] ?? "";
    const { plaintiffs, defendants } = extractPartiesFromCell(partyCell);
    const hearingType = cells[4]?.trim();

    const parties = [
      ...splitPartyBlock(plaintiffs, "plaintiff"),
      ...splitPartyBlock(defendants, "defendant"),
    ];

    cases.push({
      court: COURT,
      caseNo,
      hearingDate,
      hearingType,
      parties,
    });
  }

  return cases;
}
