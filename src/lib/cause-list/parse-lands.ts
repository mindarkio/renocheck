import { parseSevenColumnCauseListHtml } from "./parse-seven-column";
import type { ParsedCauseListCase } from "./types";

export type LandsParseResult = {
  cases: ParsedCauseListCase[];
  rowCount: number;
  caseNoCount: number;
};

export function parseLandsCauseListHtml(
  html: string,
  listDateDdMmYyyy: string,
): LandsParseResult {
  return parseSevenColumnCauseListHtml(html, listDateDdMmYyyy, "LANDS", "labeled");
}
