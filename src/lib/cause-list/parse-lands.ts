import { extractRowCells, extractTableRows, parseDclListDate } from "./parse-html-utils";
import type { CauseListCourtCode, ParsedCauseListCase } from "./types";
import { splitPartyBlock } from "./party";

const COURT: CauseListCourtCode = "LANDS";

function extractPartiesFromCell(cell: string): {
  applicants: string;
  respondents: string;
} {
  const text = cell.replace(/\r/g, "");
  const applicantMatch = text.match(
    /Applicant\(s\)\s*[:：]?\s*([\s\S]*?)(?=Respondent\(s\)|$)/i,
  );
  const respondentMatch = text.match(/Respondent\(s\)\s*[:：]?\s*([\s\S]*?)$/i);
  return {
    applicants: applicantMatch?.[1]?.trim() ?? "",
    respondents: respondentMatch?.[1]?.trim() ?? "",
  };
}

export function parseLandsCauseListHtml(
  html: string,
  listDateDdMmYyyy: string,
): ParsedCauseListCase[] {
  const hearingDate = parseDclListDate(listDateDdMmYyyy);
  const cases: ParsedCauseListCase[] = [];

  for (const row of extractTableRows(html)) {
    const cells = extractRowCells(row);
    if (cells.length < 4) continue;
    const caseNo = cells[2]?.trim();
    if (!caseNo || !/^LD/i.test(caseNo)) continue;

    const partyCell = cells[3] ?? "";
    const { applicants, respondents } = extractPartiesFromCell(partyCell);
    const hearingType = cells[4]?.trim();

    const parties = [
      ...splitPartyBlock(applicants, "applicant"),
      ...splitPartyBlock(respondents, "respondent"),
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
