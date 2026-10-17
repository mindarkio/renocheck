/**
 * Resumable Wayback backfill of Daily Cause List pages.
 * Courts: SMT, DC, CACFI, LANDS. Default window: 2024-11-01 through today (UTC).
 *
 * Raw HTML stays in gitignored `.cache/cause-list/`.
 * Company-only rows (Limited / Ltd / 有限公司 defendants and respondents) go to
 * `scripts/output/cause-list-backfill.csv` and `cause-list-backfill-summary.json`.
 *
 * Usage:
 *   pnpm cause-list:backfill
 *   pnpm cause-list:backfill --from 2024-11-01 --to 2026-10-17
 *   pnpm cause-list:backfill --report-only
 *   pnpm cause-list:backfill --refresh-cdx
 *
 * Does not read or write Supabase. MWC matching uses the public BD register CSV
 * when that file is present; otherwise every row is matchLevel unmatched.
 */
import { mkdir, readdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import {
  BACKFILL_COURTS,
  BACKFILL_FROM_ISO,
  calendarMonthChunks,
  courtDateFromCacheName,
  isTransientArchiveHtml,
  isoToCompact,
  isoTodayUtc,
  mergeSnapshots,
  pageLooksLikeCauseList,
  parseCdxJson,
  selectCauseListSnapshots,
  snapshotCacheName,
  type CauseListSnapshot,
} from "../../src/lib/cause-list/cdx";
import {
  assertCorporateBackfillRows,
  backfillRowsToCsv,
  buildBackfillSummary,
  createBackfillAggregator,
  type BackfillSummary,
} from "../../src/lib/cause-list/backfill-report";
import {
  CAUSE_LIST_USER_AGENT,
  DCL_LIVE_ORIGIN,
  buildCdxSearchUrl,
  buildDclLiveUrl,
  buildWaybackRawUrl,
  causeListPoliteDelayMs,
} from "../../src/lib/cause-list/dcl-url";
import { detectLegacyCaseFormat } from "../../src/lib/cause-list/case-no";
import { isDefendantSideRole, isRenovationRelevantCase } from "../../src/lib/cause-list/filter";
import { isCorporateEntityName, parseCorporateParties } from "../../src/lib/cause-list/party";
import {
  fetchDclHtml,
  isPathDisallowedByRobots,
  loadRobotsDisallowPrefixes,
} from "../../src/lib/cause-list/fetch-dcl";
import { corporateRegistryFromRegistersCsv } from "../../src/lib/cause-list/mwc-public-registry";
import { parseCacfiCauseListHtml } from "../../src/lib/cause-list/parse-cacfi";
import { parseDcCauseListHtml } from "../../src/lib/cause-list/parse-dc";
import { parseLandsCauseListHtml } from "../../src/lib/cause-list/parse-lands";
import { parseSmtCauseListHtml } from "../../src/lib/cause-list/parse-smt";
import type { CauseListCourtCode, ParsedCauseListCase } from "../../src/lib/cause-list/types";
import type { CauseListCompanyFixture } from "../../src/lib/cause-list/fixtures/companies.fixture";

const PARSERS: Record<
  CauseListCourtCode,
  (html: string, date: string) => { cases: ParsedCauseListCase[] }
> = {
  SMT: parseSmtCauseListHtml,
  DC: parseDcCauseListHtml,
  CACFI: parseCacfiCauseListHtml,
  LANDS: parseLandsCauseListHtml,
};

type CdxState = {
  from: string;
  to: string;
  completedChunks: string[];
  snapshots: CauseListSnapshot[];
};

type PageTally = BackfillSummary["pages"];

function parseArgs(argv: string[]) {
  let from = BACKFILL_FROM_ISO;
  let to = isoTodayUtc();
  let reportOnly = false;
  let refreshCdx = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--from" && argv[i + 1]) from = argv[++i];
    else if (argv[i] === "--to" && argv[i + 1]) to = argv[++i];
    else if (argv[i] === "--report-only") reportOnly = true;
    else if (argv[i] === "--refresh-cdx") refreshCdx = true;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("--from and --to must be YYYY-MM-DD");
  }
  if (from > to) throw new Error("--from is after --to");
  return { from, to, reportOnly, refreshCdx };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function politeWait(): Promise<void> {
  const delay = causeListPoliteDelayMs();
  console.info(JSON.stringify({ event: "polite_wait_ms", delay }));
  await sleep(delay);
}

function log(event: Record<string, string | number | boolean | null>): void {
  console.info(JSON.stringify(event));
}

function emptyRowsParsed(): Record<CauseListCourtCode, number> {
  return { SMT: 0, DC: 0, CACFI: 0, LANDS: 0 };
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

function findCachedHtml(files: string[], snap: CauseListSnapshot): string | null {
  const exact = snapshotCacheName(snap);
  if (files.includes(exact)) return exact;
  const prefix = `${snap.court}_${snap.dateDdMmYyyy}`;
  const candidates = files.filter(
    (name) =>
      name === `${prefix}.html` ||
      (name.startsWith(`${prefix}_wb`) && name.endsWith(".html")),
  );
  candidates.sort();
  return candidates.at(-1) ?? null;
}

async function loadCdxState(
  cachePath: string,
  from: string,
  to: string,
  refresh: boolean,
): Promise<CdxState> {
  if (!refresh) {
    try {
      const raw = await readFile(cachePath, "utf8");
      const parsed = JSON.parse(raw) as CdxState;
      if (parsed.from === from && parsed.to === to && Array.isArray(parsed.snapshots)) {
        return {
          from,
          to,
          completedChunks: parsed.completedChunks ?? [],
          snapshots: parsed.snapshots,
        };
      }
    } catch {
      // fresh listing
    }
  }
  return { from, to, completedChunks: [], snapshots: [] };
}

async function fetchSnapshots(
  cacheDir: string,
  from: string,
  to: string,
  refreshCdx: boolean,
  archiveRules: string[],
): Promise<CauseListSnapshot[]> {
  const cdxPath = "/cdx/search/cdx";
  if (isPathDisallowedByRobots(cdxPath, archiveRules)) {
    throw new Error("robots.txt disallows fetch for https://web.archive.org/cdx/search/cdx");
  }

  const cachePath = path.join(cacheDir, "backfill-cdx.json");
  const state = await loadCdxState(cachePath, from, to, refreshCdx);
  const chunks = calendarMonthChunks(from, to);

  for (const chunk of chunks) {
    const id = `${chunk.fromIso}|${chunk.toIso}`;
    if (state.completedChunks.includes(id)) continue;
    const url = buildCdxSearchUrl(isoToCompact(chunk.fromIso), isoToCompact(chunk.toIso));
    let selected: CauseListSnapshot[] | null = null;
    for (let attempt = 0; attempt < 3 && !selected; attempt++) {
      await politeWait();
      try {
        const body = await fetchDclHtml(url, {
          userAgent: CAUSE_LIST_USER_AGENT,
          timeoutMs: 90000,
          maxRetries: 4,
        });
        selected = selectCauseListSnapshots(parseCdxJson(body), chunk.fromIso, chunk.toIso);
      } catch {
        log({ event: "cdx_retry", from: chunk.fromIso, to: chunk.toIso, attempt });
      }
    }
    if (!selected) {
      throw new Error(`cdx_failed ${chunk.fromIso} ${chunk.toIso}`);
    }
    state.snapshots = mergeSnapshots(state.snapshots, selected);
    state.completedChunks.push(id);
    await writeFile(cachePath, JSON.stringify(state), "utf8");
    log({
      event: "cdx_chunk",
      from: chunk.fromIso,
      to: chunk.toIso,
      dates: selected.length,
    });
  }

  return state.snapshots;
}

async function writeReport(input: {
  from: string;
  to: string;
  complete: boolean;
  companies: CauseListCompanyFixture[];
  mwcMode: BackfillSummary["mwcRegistry"]["mode"];
  snapshots: CauseListSnapshot[];
  cacheDir: string;
  fetchFailures: number;
}): Promise<BackfillSummary> {
  const files = await readdir(input.cacheDir).catch(() => [] as string[]);
  const fetchedKeys = new Set<string>();
  const rowsParsed = emptyRowsParsed();
  const pages: PageTally = {
    empty: 0,
    unsupported: 0,
    legacyFormat: 0,
    parseFailures: 0,
    fetchFailures: input.fetchFailures,
  };
  const parseFailures: BackfillSummary["parseFailures"] = [];
  const aggregator = createBackfillAggregator(input.companies);

  for (const snap of input.snapshots) {
    const filename = findCachedHtml(files, snap);
    if (!filename) continue;
    fetchedKeys.add(`${snap.court}|${snap.dateDdMmYyyy}`);
    const html = await readFile(path.join(input.cacheDir, filename), "utf8");
    if (detectLegacyCaseFormat(html)) pages.legacyFormat += 1;
    if (!pageLooksLikeCauseList(html)) {
      pages.unsupported += 1;
      log({ event: "page", court: snap.court, date: snap.dateDdMmYyyy, result: "unsupported" });
      continue;
    }
    try {
      const parsed = PARSERS[snap.court](html, snap.dateDdMmYyyy);
      rowsParsed[snap.court] += parsed.cases.length;
      if (parsed.cases.length === 0) {
        pages.empty += 1;
        log({ event: "page", court: snap.court, date: snap.dateDdMmYyyy, result: "empty", rows: 0 });
        continue;
      }
      aggregator.add(parsed.cases);
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

  const aggregated = aggregator.finish();
  assertCorporateBackfillRows(aggregated.rows);
  const corporate = emptyRowsParsed();
  for (const court of BACKFILL_COURTS) {
    corporate[court] = aggregated.byCourt[court].corporateRenovationRelevantRows;
  }

  const summary = buildBackfillSummary({
    from: input.from,
    to: input.to,
    generatedAt: new Date().toISOString(),
    complete: input.complete,
    mwcMode: input.mwcMode,
    corporateCompanies: input.companies.length,
    snapshots: input.snapshots,
    fetchedKeys,
    rowsParsed,
    corporateRenovationRelevantRows: corporate,
    rows: aggregated.rows,
    pages,
    parseFailures,
  });

  const outDir = path.join(process.cwd(), "scripts", "output");
  await mkdir(outDir, { recursive: true });
  const csvPath = path.join(outDir, "cause-list-backfill.csv");
  const summaryPath = path.join(outDir, "cause-list-backfill-summary.json");
  await writeFile(csvPath, backfillRowsToCsv(aggregated.rows), "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const artifactDir = "/opt/cursor/artifacts";
  await mkdir(artifactDir, { recursive: true });
  await copyFile(csvPath, path.join(artifactDir, "cause-list-backfill.csv"));
  await copyFile(summaryPath, path.join(artifactDir, "cause-list-backfill-summary.json"));

  log({
    event: "backfill_report",
    complete: input.complete,
    dedupedCases: summary.totals.dedupedCases,
    distinctCompaniesA: summary.totals.distinctCompaniesA,
    distinctCompaniesB: summary.totals.distinctCompaniesB,
    csv: csvPath,
    summary: summaryPath,
  });
  return summary;
}

async function main() {
  const { from, to, reportOnly, refreshCdx } = parseArgs(process.argv.slice(2));
  const cacheDir = path.join(process.cwd(), ".cache", "cause-list");
  await mkdir(cacheDir, { recursive: true });

  let companies: CauseListCompanyFixture[] = [];
  let mwcMode: BackfillSummary["mwcRegistry"]["mode"] = "unmatched-no-registry";
  try {
    const csvText = await readFile(
      path.join(process.cwd(), "docs/sourcedata/registers_full_list.csv"),
      "utf8",
    );
    companies = corporateRegistryFromRegistersCsv(csvText);
    if (companies.length > 0) mwcMode = "offline-public-register";
  } catch {
    mwcMode = "unmatched-no-registry";
  }
  log({
    event: "mwc_registry",
    mode: mwcMode,
    corporateCompanies: companies.length,
  });

  let stop = false;
  const requestStop = () => {
    stop = true;
    log({ event: "stop_requested" });
  };
  process.on("SIGINT", requestStop);
  process.on("SIGTERM", requestStop);

  let archiveRules: string[] = [];
  let snapshots: CauseListSnapshot[] = [];
  let fetchFailures = 0;

  if (!reportOnly) {
    await politeWait();
    const judiciaryRules = await loadRobotsDisallowPrefixes(
      DCL_LIVE_ORIGIN,
      CAUSE_LIST_USER_AGENT,
    );
    const livePath = new URL(buildDclLiveUrl("01112024", "SMT")).pathname;
    if (isPathDisallowedByRobots(livePath, judiciaryRules)) {
      throw new Error(`robots.txt disallows fetch for ${DCL_LIVE_ORIGIN}${livePath}`);
    }

    await politeWait();
    archiveRules = await loadRobotsDisallowPrefixes(
      "https://web.archive.org",
      CAUSE_LIST_USER_AGENT,
    );
    snapshots = await fetchSnapshots(cacheDir, from, to, refreshCdx, archiveRules);
  } else {
    const cdxPath = path.join(cacheDir, "backfill-cdx.json");
    const state = await loadCdxState(cdxPath, from, to, false);
    snapshots = state.snapshots;
  }

  const byCourt = emptyRowsParsed();
  for (const snap of snapshots) byCourt[snap.court] += 1;
  log({
    event: "cdx_ready",
    snapshots: snapshots.length,
    SMT: byCourt.SMT,
    DC: byCourt.DC,
    CACFI: byCourt.CACFI,
    LANDS: byCourt.LANDS,
  });

  if (!reportOnly) {
    const existing = new Set(
      (await readdir(cacheDir).catch(() => [] as string[]))
        .map((name) => courtDateFromCacheName(name))
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .map((row) => `${row.court}|${row.dateDdMmYyyy}`),
    );
    let done = 0;
    const pending = snapshots.filter(
      (snap) => !existing.has(`${snap.court}|${snap.dateDdMmYyyy}`),
    );
    log({ event: "fetch_plan", pending: pending.length, cached: snapshots.length - pending.length });

    for (const snap of pending) {
      if (stop) break;
      const rawUrl = buildWaybackRawUrl(snap.timestamp, snap.original);
      const pathname = new URL(rawUrl).pathname;
      if (isPathDisallowedByRobots(pathname, archiveRules)) {
        log({ event: "fetch", court: snap.court, date: snap.dateDdMmYyyy, result: "robots_blocked" });
        fetchFailures += 1;
        continue;
      }
      await politeWait();
      try {
        const html = await fetchDclHtml(rawUrl, {
          userAgent: CAUSE_LIST_USER_AGENT,
          timeoutMs: 45000,
          maxRetries: 4,
        });
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
        const outPath = path.join(cacheDir, snapshotCacheName(snap));
        await writeFile(outPath, html, "utf8");
        done += 1;
        let probeRows = -1;
        let probeKept = -1;
        let probeResult = "cached";
        try {
          const parsed = PARSERS[snap.court](html, snap.dateDdMmYyyy);
          probeRows = parsed.cases.length;
          probeKept = countKeptCorporateRows(parsed.cases);
        } catch (error) {
          probeResult =
            error instanceof Error && error.message.startsWith("DCL page date mismatch")
              ? "date_mismatch"
              : "parse_error";
        }
        log({
          event: "fetch",
          court: snap.court,
          date: snap.dateDdMmYyyy,
          result: probeResult,
          bytes: html.length,
          rows: probeRows,
          kept: probeKept,
          done,
          pending: pending.length,
        });
      } catch {
        fetchFailures += 1;
        log({ event: "fetch", court: snap.court, date: snap.dateDdMmYyyy, result: "fetch_failed" });
      }
    }
  }

  const files = await readdir(cacheDir).catch(() => [] as string[]);
  const have = new Set(
    snapshots
      .filter((snap) => findCachedHtml(files, snap))
      .map((snap) => `${snap.court}|${snap.dateDdMmYyyy}`),
  );
  const complete = !stop && snapshots.every((snap) => have.has(`${snap.court}|${snap.dateDdMmYyyy}`));

  await writeReport({
    from,
    to,
    complete,
    companies,
    mwcMode,
    snapshots,
    cacheDir,
    fetchFailures,
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "backfill_failed";
  const safe =
    message.length < 300 && !/[\u4e00-\u9fff]/.test(message) ? message : "backfill_failed";
  console.error(JSON.stringify({ event: "backfill_failed", message: safe }));
  process.exit(1);
});
