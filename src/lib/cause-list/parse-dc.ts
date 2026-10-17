import { parseSevenColumnCauseListHtml } from "./parse-seven-column";
import type { ParsedCauseListCase } from "./types";

export type DcParseResult = {
  cases: ParsedCauseListCase[];
  rowCount: number;
  caseNoCount: number;
};

export function parseDcCauseListHtml(
  html: string,
  listDateDdMmYyyy: string,
): DcParseResult {
  return parseSevenColumnCauseListHtml(html, listDateDdMmYyyy, "DC", "labeled");
}
