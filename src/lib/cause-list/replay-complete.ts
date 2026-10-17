import { countRawCaseNosInHtml } from "./case-no";
import { countSmtTables } from "./parse-smt";
import type { CauseListCourtCode } from "./types";

/**
 * Wayback `id_` replays append a title script after `</html>`.
 * A byte-sliced replay does not reach that close.
 */
export function replayHtmlIsClosed(html: string): boolean {
  return /<\/html>(?:\s|<script\b[^>]*>[\s\S]*?<\/script>)*\s*$/i.test(html);
}

/**
 * Accept a replay only when it is closed and the parsed case count agrees
 * with the raw case-number tokens (SMT also agrees with SCTC table count).
 * Non-SMT pages may cite another case number inside a narrative cell, so a
 * closed page is truncated only when the parser saw more cases than tokens.
 */
export function isCompleteReplay(
  court: CauseListCourtCode,
  html: string,
  parsedCaseCount: number,
): boolean {
  if (!replayHtmlIsClosed(html)) return false;
  const raw = countRawCaseNosInHtml(html);
  if (court === "SMT") {
    return countSmtTables(html) === parsedCaseCount && raw === parsedCaseCount;
  }
  return raw >= parsedCaseCount;
}
