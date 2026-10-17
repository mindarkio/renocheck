import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { FetchFatal } from "../bd-register/fetch-csv";
import {
  isNoHearingPage,
  isTransientArchiveHtml,
  snapshotCacheName,
  type CauseListSnapshot,
} from "./cdx";
import { buildWaybackRawUrl } from "./dcl-url";
import { isDefendantSideRole, isRenovationRelevantCase } from "./filter";
import { isPathDisallowedByRobots } from "./fetch-dcl";
import { isCorporateEntityName, parseCorporateParties } from "./party";
import { parseCacfiCauseListHtml } from "./parse-cacfi";
import { parseDcCauseListHtml } from "./parse-dc";
import { parseLandsCauseListHtml } from "./parse-lands";
import { parseSmtCauseListHtml } from "./parse-smt";
import { isCompleteReplay, replayHtmlIsClosed } from "./replay-complete";
import type { CauseListCourtCode, ParsedCauseListCase } from "./types";

export const CONSECUTIVE_RATE_LIMIT_STOP = 5;

const PARSERS: Record<
  CauseListCourtCode,
  (html: string, date: string) => { cases: ParsedCauseListCase[] }
> = {
  SMT: parseSmtCauseListHtml,
  DC: parseDcCauseListHtml,
  CACFI: parseCacfiCauseListHtml,
  LANDS: parseLandsCauseListHtml,
};

export type SnapshotFetchStats = {
  fetchFailures: number;
  stoppedReason?: "rate_limited";
};

export type SnapshotFetchDeps = {
  cacheDir: string;
  archiveRules: string[];
  politeWait: () => Promise<void>;
  fetchHtml: (url: string) => Promise<string>;
  shouldStop?: () => boolean;
  log?: (event: Record<string, string | number | boolean | null>) => void;
};

function isRateLimitError(error: unknown): boolean {
  return error instanceof FetchFatal && /^fetch failed (403|429)\b/.test(error.message);
}

function countKeptCorporateRows(cases: ParsedCauseListCase[]): number {
  let kept = 0;
  for (const caseRow of cases) {
    if (!isRenovationRelevantCase(caseRow)) continue;
    kept += parseCorporateParties(caseRow.parties).filter(
      (party) => isDefendantSideRole(party.role) && isCorporateEntityName(party.legalName),
    ).length;
  }
  return kept;
}

export async function fetchMissingSnapshots(
  pending: CauseListSnapshot[],
  deps: SnapshotFetchDeps,
): Promise<SnapshotFetchStats> {
  let fetchFailures = 0;
  let consecutiveRateLimit = 0;
  let stoppedReason: SnapshotFetchStats["stoppedReason"];
  const log = deps.log ?? (() => {});

  for (const snap of pending) {
    if (deps.shouldStop?.()) break;
    const rawUrl = buildWaybackRawUrl(snap.timestamp, snap.original);
    const pathname = new URL(rawUrl).pathname;
    if (isPathDisallowedByRobots(pathname, deps.archiveRules)) {
      fetchFailures += 1;
      consecutiveRateLimit = 0;
      log({
        event: "fetch",
        court: snap.court,
        date: snap.dateDdMmYyyy,
        result: "robots_blocked",
      });
      continue;
    }

    await deps.politeWait();
    let html: string;
    try {
      html = await deps.fetchHtml(rawUrl);
    } catch (error) {
      fetchFailures += 1;
      log({
        event: "fetch",
        court: snap.court,
        date: snap.dateDdMmYyyy,
        result: "fetch_failed",
      });
      if (isRateLimitError(error)) {
        consecutiveRateLimit += 1;
        if (consecutiveRateLimit >= CONSECUTIVE_RATE_LIMIT_STOP) {
          stoppedReason = "rate_limited";
          break;
        }
      } else {
        consecutiveRateLimit = 0;
      }
      continue;
    }

    consecutiveRateLimit = 0;
    const outPath = path.join(deps.cacheDir, snapshotCacheName(snap));
    const writeCache = async () => {
      await mkdir(deps.cacheDir, { recursive: true });
      await writeFile(outPath, html, "utf8");
    };

    if (isNoHearingPage(html)) {
      await writeCache();
      log({
        event: "fetch",
        court: snap.court,
        date: snap.dateDdMmYyyy,
        result: "no_hearing",
        bytes: html.length,
      });
      continue;
    }

    if (isTransientArchiveHtml(html)) {
      fetchFailures += 1;
      log({
        event: "fetch",
        court: snap.court,
        date: snap.dateDdMmYyyy,
        result: "transient",
        bytes: html.length,
      });
      continue;
    }

    if (!replayHtmlIsClosed(html)) {
      fetchFailures += 1;
      log({
        event: "fetch",
        court: snap.court,
        date: snap.dateDdMmYyyy,
        result: "truncated",
        bytes: html.length,
      });
      continue;
    }

    try {
      const parsed = PARSERS[snap.court](html, snap.dateDdMmYyyy);
      if (!isCompleteReplay(snap.court, html, parsed.cases.length)) {
        fetchFailures += 1;
        log({
          event: "fetch",
          court: snap.court,
          date: snap.dateDdMmYyyy,
          result: "truncated",
          bytes: html.length,
          rows: parsed.cases.length,
        });
        continue;
      }
      await writeCache();
      log({
        event: "fetch",
        court: snap.court,
        date: snap.dateDdMmYyyy,
        result: "cached",
        bytes: html.length,
        rows: parsed.cases.length,
        kept: countKeptCorporateRows(parsed.cases),
      });
    } catch (error) {
      await writeCache();
      const result =
        error instanceof Error && error.message.startsWith("DCL page date mismatch")
          ? "date_mismatch"
          : "parse_error";
      log({
        event: "fetch",
        court: snap.court,
        date: snap.dateDdMmYyyy,
        result,
        bytes: html.length,
      });
    }
  }

  return stoppedReason ? { fetchFailures, stoppedReason } : { fetchFailures };
}
