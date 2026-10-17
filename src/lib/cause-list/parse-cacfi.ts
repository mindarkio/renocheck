import { parseSevenColumnCauseListHtml } from "./parse-seven-column";
import type { ParsedCauseListCase } from "./types";

export type CacfiParseResult = {
  cases: ParsedCauseListCase[];
  rowCount: number;
  caseNoCount: number;
};

export function parseCacfiCauseListHtml(
  html: string,
  listDateDdMmYyyy: string,
): CacfiParseResult {
  return parseSevenColumnCauseListHtml(
    html,
    listDateDdMmYyyy,
    "CACFI",
    "and_split",
  );
}
