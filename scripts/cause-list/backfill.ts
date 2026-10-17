/**
 * Resumable Wayback backfill of Daily Cause List pages.
 * Courts: SMT, DC, CACFI, LANDS. Default window: 2024-11-01 through today (UTC).
 *
 * Raw HTML stays in gitignored `.cache/cause-list/`.
 * Company-only rows go to `scripts/output/` (override with `--out`).
 *
 * Usage:
 *   pnpm cause-list:backfill
 *   pnpm cause-list:backfill --from 2024-11-01 --to 2026-10-17
 *   pnpm cause-list:backfill --report-only
 *   pnpm cause-list:backfill --refresh-cdx
 *   pnpm cause-list:backfill --no-registry
 *   pnpm cause-list:backfill --out scripts/output
 *
 * Does not read or write Supabase. Matching uses the cached BD register
 * (`.cache/bd-register/`, 7-day TTL). Missing or stale cache exits 1.
 * `--no-registry` is the only unmatched mode. Five consecutive 403/429
 * responses stop the run (exit 2) after the report is written.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BD_REGISTER_CSV_PATH, BD_REGISTER_META_PATH } from "../../src/lib/bd-register/paths";
import { parseBdRegisterCsvFromBytes } from "../../src/lib/bd-register/parse";
import { assertBdCsvSanity, sanityCountsFromEntries } from "../../src/lib/bd-register/sanity";
import { resolveCandidateRetrievedAt } from "../../src/lib/bd-register/candidate-meta";
import { fetchMissingSnapshots } from "../../src/lib/cause-list/backfill-fetch";
import {
  assertCorporateBackfillRows,
  backfillRowsToCsv,
  buildBackfillSummary,
  createBackfillAggregator,
  publicBackfillError,
  type BackfillSummary,
} from "../../src/lib/cause-list/backfill-report";
import { scanCachedSnapshots } from "../../src/lib/cause-list/backfill-scan";
import { assertCacheFileFresh } from "../../src/lib/cause-list/cache-ttl";
import {
  BACKFILL_COURTS,
  BACKFILL_FROM_ISO,
  cdxCaptureWindow,
  isoToCompact,
  isoTodayUtc,
  parseCdxJson,
  selectCauseListSnapshots,
  snapshotCacheName,
  type CauseListSnapshot,
} from "../../src/lib/cause-list/cdx";
import {
  CAUSE_LIST_USER_AGENT,
  DCL_LIVE_ORIGIN,
  buildCdxSearchUrl,
  buildDclLiveUrl,
  causeListPoliteDelayMs,
} from "../../src/lib/cause-list/dcl-url";
import {
  fetchDclHtml,
  isPathDisallowedByRobots,
  loadRobotsDisallowPrefixes,
} from "../../src/lib/cause-list/fetch-dcl";
import type { CauseListCourtCode } from "../../src/lib/cause-list/types";
import type { CauseListCompanyFixture } from "../../src/lib/cause-list/fixtures/companies.fixture";

type CdxState = {
  mode: "global";
  from: string;
  to: string;
  captureFrom: string;
  captureTo: string;
  snapshots: CauseListSnapshot[];
};

type PageTally = BackfillSummary["pages"];

function parseArgs(argv: string[]) {
  let from = BACKFILL_FROM_ISO;
  let to = isoTodayUtc();
  let reportOnly = false;
  let refreshCdx = false;
  let noRegistry = false;
  let outDir = path.join(process.cwd(), "scripts", "output");
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--from" && argv[i + 1]) from = argv[++i];
    else if (arg === "--to" && argv[i + 1]) to = argv[++i];
    else if (arg === "--out" && argv[i + 1]) outDir = path.resolve(argv[++i]);
    else if (arg === "--report-only") reportOnly = true;
    else if (arg === "--refresh-cdx") refreshCdx = true;
    else if (arg === "--no-registry") noRegistry = true;
    else if (arg.startsWith("--")) throw new Error(`refusing non-option ${arg}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("--from and --to must be YYYY-MM-DD");
  }
  if (from > to) throw new Error("--from is after --to");
  return { from, to, reportOnly, refreshCdx, noRegistry, outDir };
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

function findCachedHtml(files: string[], snap: CauseListSnapshot): string | null {
  const exact = snapshotCacheName(snap);
  return files.includes(exact) ? exact : null;
}

async function loadCdxState(
  cachePath: string,
  from: string,
  to: string,
  refresh: boolean,
): Promise<CauseListSnapshot[] | null> {
  if (refresh) return null;
  const bounds = cdxCaptureWindow(from, to);
  try {
    const parsed = JSON.parse(await readFile(cachePath, "utf8")) as Partial<CdxState>;
    if (
      parsed.mode === "global" &&
      parsed.from === from &&
      parsed.to === to &&
      parsed.captureFrom === bounds.fromIso &&
      parsed.captureTo === bounds.toIso &&
      Array.isArray(parsed.snapshots)
    ) {
      return parsed.snapshots;
    }
  } catch {
    // refetch
  }
  return null;
}

/** Report-only may reuse the snapshot list already stored, including a pre-global cache. */
async function loadReportSnapshots(
  cachePath: string,
  from: string,
  to: string,
): Promise<CauseListSnapshot[]> {
  const global = await loadCdxState(cachePath, from, to, false);
  if (global) return global;
  try {
    const parsed = JSON.parse(await readFile(cachePath, "utf8")) as {
      from?: string;
      to?: string;
      snapshots?: CauseListSnapshot[];
    };
    if (parsed.from === from && parsed.to === to && Array.isArray(parsed.snapshots)) {
      return parsed.snapshots;
    }
  } catch {
    // no cache
  }
  return [];
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
  const cached = await loadCdxState(cachePath, from, to, refreshCdx);
  if (cached) return cached;

  const bounds = cdxCaptureWindow(from, to);
  const url = buildCdxSearchUrl(isoToCompact(bounds.fromIso), isoToCompact(bounds.toIso));
  let selected: CauseListSnapshot[] | null = null;
  for (let attempt = 0; attempt < 3 && !selected; attempt++) {
    await politeWait();
    try {
      const body = await fetchDclHtml(url, {
        userAgent: CAUSE_LIST_USER_AGENT,
        timeoutMs: 120000,
        maxRetries: 4,
      });
      selected = selectCauseListSnapshots(parseCdxJson(body), from, to);
    } catch {
      log({ event: "cdx_retry", from, to, attempt });
    }
  }
  if (!selected) throw new Error(`cdx_failed ${from} ${to}`);

  const state: CdxState = {
    mode: "global",
    from,
    to,
    captureFrom: bounds.fromIso,
    captureTo: bounds.toIso,
    snapshots: selected,
  };
  await writeFile(cachePath, JSON.stringify(state), "utf8");
  log({
    event: "cdx_window",
    from: bounds.fromIso,
    to: bounds.toIso,
    dates: selected.length,
  });
  return selected;
}

async function loadRegistry(noRegistry: boolean): Promise<{
  companies: CauseListCompanyFixture[];
  mwcMode: BackfillSummary["mwcRegistry"]["mode"];
  retrievedAt: string | null;
}> {
  if (noRegistry) {
    return { companies: [], mwcMode: "unmatched-no-registry", retrievedAt: null };
  }
  try {
    await assertCacheFileFresh(
      BD_REGISTER_CSV_PATH,
      "BD register cache (run pnpm bd-register:fetch)",
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new Error("BD register cache missing ENOENT");
    throw error;
  }
  const { entries } = parseBdRegisterCsvFromBytes(await readFile(BD_REGISTER_CSV_PATH));
  assertBdCsvSanity(sanityCountsFromEntries(entries));
  const companies = entries
    .filter((entry) => entry.registerType === "MWC" && !entry.unincorporated && (entry.nameEn || entry.nameZh))
    .map((entry) => ({
      id: entry.regNo,
      namesEn: entry.nameEn ? [entry.nameEn] : [],
      namesZh: entry.nameZh ? [entry.nameZh] : [],
    }));
  const retrievedAt = await resolveCandidateRetrievedAt(
    BD_REGISTER_CSV_PATH,
    BD_REGISTER_META_PATH,
  );
  return { companies, mwcMode: "offline-public-register", retrievedAt };
}

async function writeReport(input: {
  from: string;
  to: string;
  complete: boolean;
  companies: CauseListCompanyFixture[];
  mwcMode: BackfillSummary["mwcRegistry"]["mode"];
  retrievedAt: string | null;
  stoppedReason?: BackfillSummary["stoppedReason"];
  snapshots: CauseListSnapshot[];
  cacheDir: string;
  outDir: string;
  fetchFailures: number;
}): Promise<BackfillSummary> {
  const files = await readdir(input.cacheDir).catch(() => [] as string[]);
  const aggregator = createBackfillAggregator(input.companies);
  const scanned = await scanCachedSnapshots({
    snapshots: input.snapshots,
    cacheDir: input.cacheDir,
    files,
    onParsed: (cases) => aggregator.add(cases),
    log,
  });
  const fetchedKeys = scanned.fetchedKeys;
  const rowsParsed = scanned.rowsParsed;
  const pages: PageTally = {
    ...scanned.pages,
    fetchFailures: input.fetchFailures,
    notFetched: input.snapshots.length - fetchedKeys.size,
  };
  const parseFailures = scanned.parseFailures;

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
    retrievedAt: input.retrievedAt,
    stoppedReason: input.stoppedReason,
    snapshots: input.snapshots,
    fetchedKeys,
    rowsParsed,
    corporateRenovationRelevantRows: corporate,
    rows: aggregated.rows,
    pages,
    parseFailures,
  });

  await mkdir(input.outDir, { recursive: true });
  const csvPath = path.join(input.outDir, "cause-list-backfill.csv");
  const summaryPath = path.join(input.outDir, "cause-list-backfill-summary.json");
  await writeFile(csvPath, backfillRowsToCsv(aggregated.rows), "utf8");
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  log({
    event: "backfill_report",
    complete: summary.complete,
    dedupedCases: summary.totals.dedupedCases,
    distinctCompaniesA: summary.totals.distinctCompaniesA,
    distinctCompaniesB: summary.totals.distinctCompaniesB,
    noHearing: summary.pages.noHearing,
    csv: csvPath,
    summary: summaryPath,
  });
  return summary;
}

async function main(): Promise<number> {
  const { from, to, reportOnly, refreshCdx, noRegistry, outDir } = parseArgs(process.argv.slice(2));
  const cacheDir = path.join(process.cwd(), ".cache", "cause-list");
  await mkdir(cacheDir, { recursive: true });

  const { companies, mwcMode, retrievedAt } = await loadRegistry(noRegistry);
  log({
    event: "mwc_registry",
    mode: mwcMode,
    corporateCompanies: companies.length,
    retrievedAt,
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
  let stoppedReason: BackfillSummary["stoppedReason"];

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
    snapshots = await loadReportSnapshots(path.join(cacheDir, "backfill-cdx.json"), from, to);
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
    const existing = new Set(await readdir(cacheDir).catch(() => [] as string[]));
    const pending = snapshots.filter((snap) => !existing.has(snapshotCacheName(snap)));
    log({ event: "fetch_plan", pending: pending.length, cached: snapshots.length - pending.length });
    const fetched = await fetchMissingSnapshots(pending, {
      cacheDir,
      archiveRules,
      politeWait,
      fetchHtml: (url) =>
        fetchDclHtml(url, {
          userAgent: CAUSE_LIST_USER_AGENT,
          timeoutMs: 45000,
          maxRetries: 4,
        }),
      shouldStop: () => stop,
      log,
    });
    fetchFailures = fetched.fetchFailures;
    stoppedReason = fetched.stoppedReason;
  }

  const files = await readdir(cacheDir).catch(() => [] as string[]);
  const have = new Set(
    snapshots
      .filter((snap) => findCachedHtml(files, snap))
      .map((snap) => `${snap.court}|${snap.dateDdMmYyyy}`),
  );
  const complete =
    !stop &&
    !stoppedReason &&
    snapshots.length > 0 &&
    snapshots.every((snap) => have.has(`${snap.court}|${snap.dateDdMmYyyy}`));

  await writeReport({
    from,
    to,
    complete,
    companies,
    mwcMode,
    retrievedAt,
    stoppedReason,
    snapshots,
    cacheDir,
    outDir,
    fetchFailures,
  });
  return stoppedReason === "rate_limited" ? 2 : 0;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(JSON.stringify({ event: "backfill_failed", message: publicBackfillError(error) }));
    process.exit(1);
  });
