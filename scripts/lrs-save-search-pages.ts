/**
 * Save LRS search result HTML (Playwright). Preferred when `fetch:judgments` times out.
 *
 *   pnpm lrs:save-search-pages --tier=A --max-pages=6
 *   pnpm lrs:save-search-pages --tier=A,B --max-pages=full
 *   pnpm lrs:save-search-pages --profile-id=phrase-裝修工程 --max-pages=3
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fetchLrsSearchNextPages,
  fetchLrsSearchPageHtml,
  profileHtmlFileName,
  sleep,
} from "./lib/lrs-playwright-fetch";
import {
  buildLrsDualFieldSearchResultUrl,
  buildLrsSearchResultUrl,
  type LrsSearchMode,
} from "../src/lib/lrs-search-url";
import {
  DEFAULT_D1_FULL_CRAWL,
  parseTierFilter,
  resolveProfileMaxPages,
  type D1FullCrawlConfig,
} from "../src/lib/d1-crawl-pages";

const OUT_DIR = resolve(process.cwd(), "scripts/output/lrs-html");
const MANIFEST_PATH = resolve(
  process.cwd(),
  "scripts/output/lrs-fetch-manifest.json",
);
const PROFILES_PATH = resolve(
  process.cwd(),
  "scripts/config/lrs-ingestion-profiles.json",
);

type LrsProfile = {
  id: string;
  tier: string;
  mode: LrsSearchMode;
  keyword: string;
  secondKeyword?: string;
  maxPagesDefault?: number;
  observedHitsJu?: number;
};

type ProfilesFile = {
  lrsProfiles: LrsProfile[];
  d1FullCrawl?: D1FullCrawlConfig;
};

type ManifestEntry = {
  profileId: string;
  tier: string;
  url: string;
  page: number;
  htmlPath: string;
  fetchedAt: string;
};

function argValue(prefix: string): string | null {
  const a = process.argv.find((x) => x.startsWith(prefix));
  return a ? a.slice(prefix.length) : null;
}

function loadProfilesFile(): ProfilesFile {
  return JSON.parse(readFileSync(PROFILES_PATH, "utf8")) as ProfilesFile;
}

function profileUrl(p: LrsProfile): string {
  if (p.secondKeyword) {
    return buildLrsDualFieldSearchResultUrl({
      txtSearch: p.keyword,
      txtSearch2: p.secondKeyword,
    });
  }
  return buildLrsSearchResultUrl({
    keyword: p.keyword,
    mode: p.mode,
    databases: ["JU"],
  });
}

function loadManifest(): ManifestEntry[] {
  try {
    const data = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
      entries: ManifestEntry[];
    };
    return data.entries ?? [];
  } catch {
    return [];
  }
}

function mergeManifest(
  previous: ManifestEntry[],
  fresh: ManifestEntry[],
): ManifestEntry[] {
  const key = (e: ManifestEntry) => `${e.profileId}::${e.page}`;
  const map = new Map(previous.map((e) => [key(e), e]));
  for (const e of fresh) map.set(key(e), e);
  return [...map.values()].sort(
    (a, b) =>
      a.profileId.localeCompare(b.profileId) || a.page - b.page,
  );
}

async function main() {
  const tierWanted = argValue("--tier=") ?? "A";
  const tierSet = parseTierFilter(tierWanted);
  const profileWanted = argValue("--profile-id=");
  const maxPagesArg = argValue("--max-pages=");
  const headed = process.argv.includes("--headed");

  const profilesFile = loadProfilesFile();
  const crawlConfig = profilesFile.d1FullCrawl ?? DEFAULT_D1_FULL_CRAWL;

  const profiles = profilesFile.lrsProfiles.filter((p) => {
    if (profileWanted) return p.id === profileWanted;
    return tierSet.has(p.tier.toUpperCase());
  });

  if (profiles.length === 0) {
    console.error(
      JSON.stringify({
        event: "lrs_save_no_profiles",
        tier: tierWanted,
        tiers: [...tierSet],
        profileId: profileWanted,
      }),
    );
    process.exit(1);
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage();
  mkdirSync(OUT_DIR, { recursive: true });

  const manifestFresh: ManifestEntry[] = [];
  const fetchedAt = new Date().toISOString();

  for (const p of profiles) {
    const maxPages = resolveProfileMaxPages(p, maxPagesArg, crawlConfig);
    const url = profileUrl(p);

    try {
      const htmlPages = [await fetchLrsSearchPageHtml(page, url)];
      if (maxPages > 1) {
        htmlPages.push(...(await fetchLrsSearchNextPages(page, maxPages)));
      }

      for (let i = 0; i < htmlPages.length; i++) {
        const pageNum = i + 1;
        const fileName = profileHtmlFileName(p.id, pageNum);
        const htmlPath = resolve(OUT_DIR, fileName);
        writeFileSync(htmlPath, htmlPages[i], "utf8");
        manifestFresh.push({
          profileId: p.id,
          tier: p.tier,
          url,
          page: pageNum,
          htmlPath,
          fetchedAt,
        });
        console.info(
          JSON.stringify({
            event: "lrs_save_page_ok",
            profileId: p.id,
            page: pageNum,
            fileName,
          }),
        );
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "lrs_save_profile_failed",
          profileId: p.id,
          error: String(err),
        }),
      );
    }

    await sleep(1500);
  }

  await browser.close();

  const merged = mergeManifest(loadManifest(), manifestFresh);
  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify({ generatedAt: fetchedAt, entries: merged }, null, 2)}\n`,
    "utf8",
  );

  console.info(
    JSON.stringify({
      event: "lrs_save_search_pages_done",
      pagesSavedThisRun: manifestFresh.length,
      manifestEntries: merged.length,
      manifest: MANIFEST_PATH,
    }),
  );

  if (manifestFresh.length === 0) process.exit(1);
}

main().catch((err) => {
  console.error(
    JSON.stringify({ event: "lrs_save_search_pages_failed", error: String(err) }),
  );
  process.exit(1);
});
