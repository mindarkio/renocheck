/**
 * J5 — fetch LRS Parties search pages for MWC queue (rate-limited).
 *
 *   pnpm j5:fetch-parties --limit=20
 *   pnpm j5:fetch-parties --limit=5 --offset=100
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildLrsPartiesSearchResultUrl } from "../src/lib/lrs-search-url";
import { parseLrsSearchResultHtml } from "../src/lib/parse-lrs-search-html";
import {
  fetchLrsSearchPageHtml,
  profileHtmlFileName,
  sleep,
} from "./lib/lrs-playwright-fetch";

const QUEUE_PATH = resolve(
  process.cwd(),
  "scripts/output/j5-mwc-party-queue.json",
);
const PROGRESS_PATH = resolve(
  process.cwd(),
  "scripts/output/j5-mwc-party-progress.json",
);
const OUT_HTML = resolve(process.cwd(), "scripts/output/lrs-html");
const MANIFEST_PATH = resolve(
  process.cwd(),
  "scripts/output/lrs-fetch-manifest.json",
);

const DEFAULT_LIMIT = 20;
const DELAY_MS = 2500;

type QueueFile = {
  entries: Array<{ registrationNo: string; companyName: string }>;
};

type ProgressFile = {
  processedRegistrationNos: string[];
  lastRunAt?: string;
};

type Manifest = {
  entries: Array<{
    profileId: string;
    tier: string;
    url: string;
    page: number;
    htmlPath: string;
    fetchedAt: string;
  }>;
};

function intArg(flag: string, fallback: number): number {
  const a = process.argv.find((x) => x.startsWith(`${flag}=`));
  if (!a) return fallback;
  const n = Number.parseInt(a.slice(flag.length + 1), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function slugRegistrationNo(reg: string): string {
  return reg.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/_+/g, "_");
}

function loadProgress(): ProgressFile {
  try {
    return JSON.parse(readFileSync(PROGRESS_PATH, "utf8")) as ProgressFile;
  } catch {
    return { processedRegistrationNos: [] };
  }
}

function loadManifest(): Manifest {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  } catch {
    return { entries: [] };
  }
}

async function loadPlaywright() {
  const pw = await import("playwright");
  return pw.chromium;
}

async function main() {
  const limit = intArg("--limit", DEFAULT_LIMIT);
  const offset = intArg("--offset", 0);

  const queue = JSON.parse(readFileSync(QUEUE_PATH, "utf8")) as QueueFile;
  const progress = loadProgress();
  const done = new Set(progress.processedRegistrationNos);
  const manifest = loadManifest();
  const fetchedAt = new Date().toISOString();

  const batch = queue.entries
    .slice(offset)
    .filter((e) => !done.has(e.registrationNo))
    .slice(0, limit);

  if (batch.length === 0) {
    console.info(
      JSON.stringify({
        event: "j5_fetch_parties_nothing_to_do",
        offset,
        limit,
        alreadyProcessed: done.size,
      }),
    );
    return;
  }

  const chromium = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  mkdirSync(OUT_HTML, { recursive: true });

  const summary: Array<Record<string, unknown>> = [];

  for (const entry of batch) {
    const url = buildLrsPartiesSearchResultUrl(entry.companyName);
    const profileId = `j5-parties-${slugRegistrationNo(entry.registrationNo)}`;

    try {
      console.info(
        JSON.stringify({
          event: "j5_fetch_parties_item_start",
          registrationNo: entry.registrationNo,
          companyName: entry.companyName,
        }),
      );
      const html = await fetchLrsSearchPageHtml(page, url);
      const file = profileHtmlFileName(profileId, 1);
      const htmlPath = resolve(OUT_HTML, file);
      writeFileSync(htmlPath, html, "utf8");

      const hits = parseLrsSearchResultHtml(html).filter((r) =>
        /^judgments$/i.test(r.database.trim()),
      );

      manifest.entries.push({
        profileId,
        tier: "J5",
        url,
        page: 1,
        htmlPath,
        fetchedAt,
      });

      done.add(entry.registrationNo);
      summary.push({
        registrationNo: entry.registrationNo,
        companyName: entry.companyName,
        judgmentHits: hits.length,
        htmlPath,
      });
    } catch (err) {
      summary.push({
        registrationNo: entry.registrationNo,
        companyName: entry.companyName,
        error: String(err),
      });
    }

    await sleep(DELAY_MS);
  }

  await browser.close();

  writeFileSync(
    PROGRESS_PATH,
    `${JSON.stringify(
      {
        processedRegistrationNos: [...done],
        lastRunAt: fetchedAt,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.info(
    JSON.stringify({
      event: "j5_fetch_parties_batch_done",
      batchSize: batch.length,
      processedTotal: done.size,
      summary,
      hint: "pnpm build:judgment-candidates && pnpm d2:prep",
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
