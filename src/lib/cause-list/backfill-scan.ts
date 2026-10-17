import { readFile } from "node:fs/promises";
import path from "node:path";
import { detectLegacyCaseFormat } from "./case-no";
import {
  isNoHearingPage,
  pageLooksLikeCauseList,
  snapshotCacheName,
  type CauseListSnapshot,
} from "./cdx";
import { parseCacfiCauseListHtml } from "./parse-cacfi";
import { parseDcCauseListHtml } from "./parse-dc";
import { parseLandsCauseListHtml } from "./parse-lands";
import { parseSmtCauseListHtml } from "./parse-smt";
import { isCompleteReplay } from "./replay-complete";
import type { CauseListCourtCode, ParsedCauseListCase } from "./types";

const PARSERS: Record<
  CauseListCourtCode,
  (html: string, date: string) => { cases: ParsedCauseListCase[] }
> = {
  SMT: parseSmtCauseListHtml,
  DC: parseDcCauseListHtml,
  CACFI: parseCacfiCauseListHtml,
  LANDS: parseLandsCauseListHtml,
};

export type CachedPageEvent = Record<string, string | number | boolean | null>;

export type CachedScan = {
  fetchedKeys: Set<string>;
  rowsParsed: Record<CauseListCourtCode, number>;
  pages: {
    empty: number;
    unsupported: number;
    legacyFormat: number;
    parseFailures: number;
    noHearing: number;
    truncated: number;
    parsed: number;
  };
  parseFailures: Array<{ court: CauseListCourtCode; date: string; kind: string }>;
};

function emptyRows(): Record<CauseListCourtCode, number> {
  return { SMT: 0, DC: 0, CACFI: 0, LANDS: 0 };
}

export async function scanCachedSnapshots(input: {
  snapshots: CauseListSnapshot[];
  cacheDir: string;
  files: string[];
  onParsed?: (cases: ParsedCauseListCase[]) => void;
  log?: (event: CachedPageEvent) => void;
}): Promise<CachedScan> {
  const files = new Set(input.files);
  const fetchedKeys = new Set<string>();
  const rowsParsed = emptyRows();
  const pages = {
    empty: 0,
    unsupported: 0,
    legacyFormat: 0,
    parseFailures: 0,
    noHearing: 0,
    truncated: 0,
    parsed: 0,
  };
  const parseFailures: CachedScan["parseFailures"] = [];
  const log = input.log ?? (() => {});

  for (const snap of input.snapshots) {
    const filename = snapshotCacheName(snap);
    if (!files.has(filename)) continue;
    fetchedKeys.add(`${snap.court}|${snap.dateDdMmYyyy}`);
    const html = await readFile(path.join(input.cacheDir, filename), "utf8");
    if (isNoHearingPage(html)) {
      pages.noHearing += 1;
      log({ event: "page", court: snap.court, date: snap.dateDdMmYyyy, result: "no_hearing" });
      continue;
    }
    const legacy = detectLegacyCaseFormat(html);
    if (legacy) pages.legacyFormat += 1;
    if (!pageLooksLikeCauseList(html)) {
      pages.unsupported += 1;
      log({ event: "page", court: snap.court, date: snap.dateDdMmYyyy, result: "unsupported" });
      continue;
    }
    try {
      const parsed = PARSERS[snap.court](html, snap.dateDdMmYyyy);
      if (!isCompleteReplay(snap.court, html, parsed.cases.length)) {
        pages.truncated += 1;
        log({ event: "page", court: snap.court, date: snap.dateDdMmYyyy, result: "truncated", rows: 0 });
        continue;
      }
      if (parsed.cases.length === 0) {
        pages.empty += 1;
        log({ event: "page", court: snap.court, date: snap.dateDdMmYyyy, result: "empty", rows: 0 });
        continue;
      }
      rowsParsed[snap.court] += parsed.cases.length;
      pages.parsed += 1;
      input.onParsed?.(parsed.cases);
      log({
        event: "page",
        court: snap.court,
        date: snap.dateDdMmYyyy,
        result: "parsed",
        rows: parsed.cases.length,
      });
    } catch (error) {
      const kind =
        error instanceof Error && error.message.startsWith("DCL page date mismatch")
          ? "date_mismatch"
          : "parse_error";
      pages.parseFailures += 1;
      parseFailures.push({ court: snap.court, date: snap.dateDdMmYyyy, kind });
      log({ event: "page", court: snap.court, date: snap.dateDdMmYyyy, result: kind });
    }
  }

  return { fetchedKeys, rowsParsed, pages, parseFailures };
}
