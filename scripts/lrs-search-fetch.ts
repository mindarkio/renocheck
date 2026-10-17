/**
 * D1 — fetch LRS search result pages (Playwright; browser session required).
 *
 * Usage:
 *   pnpm fetch:judgments
 *   pnpm fetch:judgments --tier=A --max-pages=2
 *   pnpm fetch:judgments --profile-id=phrase-裝修工程 --max-pages=1
 *
 * Requires: pnpm exec playwright install chromium (once per machine).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fetchLrsSearchNextPages,
  fetchLrsSearchPageHtml,
  profileHtmlFileName,
  sleep,
} from "./lib/lrs-playwright-fetch";

const SOURCE_URLS_PATH = resolve(
  process.cwd(),
  "scripts/output/judgment-source-urls.json",
);
const PROFILES_PATH = resolve(
  process.cwd(),
  "scripts/config/lrs-ingestion-profiles.json",
);
const OUT_HTML_DIR = resolve(process.cwd(), "scripts/output/lrs-html");
const MANIFEST_PATH = resolve(
  process.cwd(),
  "scripts/output/lrs-fetch-manifest.json",
);

type SourceUrlsFile = {
  entries: Array<{
    provider: string;
    tier?: string;
    profileId?: string;
    url: string;
    maxPagesDefault?: number;
  }>;
};

type ProfilesFile = {
  lrsProfiles: Array<{ id: string; tier: string; maxPagesDefault?: number }>;
};

function tierFilter(argv: string[]): string | null {
  const arg = argv.find((a) => a.startsWith("--tier="));
  return arg ? arg.slice("--tier=".length).toUpperCase() : null;
}

function maxPagesOverride(argv: string[]): number | null {
  const arg = argv.find((a) => a.startsWith("--max-pages="));
  return arg ? Number.parseInt(arg.slice("--max-pages=".length), 10) : null;
}

function profileIdFilter(argv: string[]): string | null {
  const arg = argv.find((a) => a.startsWith("--profile-id="));
  return arg ? arg.slice("--profile-id=".length) : null;
}

async function loadPlaywright() {
  try {
    const pw = await import("playwright");
    return pw.chromium;
  } catch {
    console.error(
      JSON.stringify({
        event: "lrs_fetch_playwright_missing",
        hint: "pnpm add -D playwright && pnpm exec playwright install chromium",
      }),
    );
    process.exit(1);
  }
}

function loadExistingManifest(): Array<{
  profileId: string;
  tier: string;
  url: string;
  page: number;
  htmlPath: string;
  fetchedAt: string;
}> {
  try {
    const data = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
      entries: Array<{
        profileId: string;
        tier: string;
        url: string;
        page: number;
        htmlPath: string;
        fetchedAt: string;
      }>;
    };
    return data.entries ?? [];
  } catch {
    return [];
  }
}

async function main() {
  const tierWanted = tierFilter(process.argv);
  const maxPagesCap = maxPagesOverride(process.argv);
  const profileWanted = profileIdFilter(process.argv);

  const sources = JSON.parse(readFileSync(SOURCE_URLS_PATH, "utf8")) as SourceUrlsFile;
  const profiles = JSON.parse(readFileSync(PROFILES_PATH, "utf8")) as ProfilesFile;
  const maxByProfile = new Map(
    profiles.lrsProfiles.map((p) => [p.id, p.maxPagesDefault ?? 1]),
  );

  const lrsEntries = sources.entries.filter(
    (e) =>
      e.provider === "lrs" &&
      (!tierWanted || (e.tier ?? "").toUpperCase() === tierWanted) &&
      (!profileWanted || e.profileId === profileWanted),
  );

  if (lrsEntries.length === 0) {
    console.error(
      JSON.stringify({
        event: "lrs_fetch_no_entries",
        hint: "pnpm discover:judgments",
        path: SOURCE_URLS_PATH,
      }),
    );
    process.exit(1);
  }

  const chromium = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  mkdirSync(OUT_HTML_DIR, { recursive: true });
  const manifestEntries: Array<{
    profileId: string;
    tier: string;
    url: string;
    page: number;
    htmlPath: string;
    fetchedAt: string;
  }> = [];

  for (const entry of lrsEntries) {
    const profileId = entry.profileId ?? "unknown";
    const tier = entry.tier ?? "?";
    const maxPages = Math.min(
      maxPagesCap ?? maxByProfile.get(profileId) ?? 1,
      maxPagesCap ?? 20,
    );

    const fetchedAt = new Date().toISOString();
    let htmlPages: string[] = [];
    try {
      htmlPages = [await fetchLrsSearchPageHtml(page, entry.url)];
      if (maxPages > 1) {
        htmlPages.push(...(await fetchLrsSearchNextPages(page, maxPages)));
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "lrs_fetch_profile_failed",
          profileId,
          error: String(err),
        }),
      );
      continue;
    }

    for (let i = 0; i < htmlPages.length; i++) {
      const pageNum = i + 1;
      const fileName = profileHtmlFileName(profileId, pageNum);
      const htmlPath = resolve(OUT_HTML_DIR, fileName);
      writeFileSync(htmlPath, htmlPages[i], "utf8");
      const relPath = `scripts/output/lrs-html/${fileName}`;
      manifestEntries.push({
        profileId,
        tier,
        url: entry.url,
        page: pageNum,
        htmlPath: resolve(process.cwd(), relPath),
        fetchedAt,
      });
    }

    await sleep(1500);
  }

  await browser.close();

  const entriesToWrite =
    manifestEntries.length > 0 ? manifestEntries : loadExistingManifest();
  if (manifestEntries.length === 0) {
    console.error(
      JSON.stringify({
        event: "lrs_fetch_no_pages_saved",
        hint: "Try pnpm lrs:save-search-pages --tier=A --max-pages=6",
        keptPreviousManifest: entriesToWrite.length,
      }),
    );
  }

  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), entries: entriesToWrite }, null, 2)}\n`,
    "utf8",
  );

  console.info(
    JSON.stringify({
      event: "lrs_fetch_done",
      htmlDir: OUT_HTML_DIR,
      manifest: MANIFEST_PATH,
      pages: manifestEntries.length,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
