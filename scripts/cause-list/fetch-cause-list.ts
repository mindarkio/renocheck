/**
 * Fetch one Daily Cause List page (live or Wayback). Raw HTML → .cache/cause-list/
 * Usage: pnpm tsx scripts/cause-list/fetch-cause-list.ts --date 16102026 --court SMT
 *        pnpm tsx scripts/cause-list/fetch-cause-list.ts --date 16102026 --court SMT --wayback 20251016120000
 *
 * Cache TTL: delete `.cache/cause-list/` HTML after offline work (contains party names); not for long-term storage.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CAUSE_LIST_USER_AGENT,
  buildDclLiveUrl,
  buildWaybackRawUrl,
  causeListPoliteDelayMs,
} from "../../src/lib/cause-list/dcl-url";
import { assertLiveDclRobotsAllowed, fetchDclHtml } from "../../src/lib/cause-list/fetch-dcl";

function parseArgs(argv: string[]) {
  let date = "";
  let court = "";
  let wayback: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--date" && argv[i + 1]) date = argv[++i];
    else if (argv[i] === "--court" && argv[i + 1]) court = argv[++i].toUpperCase();
    else if (argv[i] === "--wayback" && argv[i + 1]) wayback = argv[++i];
  }
  if (!/^\d{8}$/.test(date)) {
    throw new Error("--date DDMMYYYY required");
  }
  if (!court) throw new Error("--court required (SMT, DC, CACFI, LANDS, …)");
  return { date, court, wayback };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { date, court, wayback } = parseArgs(process.argv.slice(2));
  const liveUrl = buildDclLiveUrl(date, court);
  const requestUrl = wayback ? buildWaybackRawUrl(wayback, liveUrl) : liveUrl;
  const delay = causeListPoliteDelayMs();
  console.info(`Waiting ${delay}ms before fetch…`);
  await sleep(delay);

  if (!wayback) {
    await assertLiveDclRobotsAllowed(requestUrl, CAUSE_LIST_USER_AGENT);
  }

  const html = await fetchDclHtml(requestUrl, { userAgent: CAUSE_LIST_USER_AGENT });
  const cacheDir = path.join(process.cwd(), ".cache", "cause-list");
  await mkdir(cacheDir, { recursive: true });
  const suffix = wayback ? `_wb${wayback}` : "";
  const outPath = path.join(cacheDir, `${court}_${date}${suffix}.html`);
  await writeFile(outPath, html, "utf8");
  console.info(`Wrote ${outPath} (${html.length} bytes) from ${requestUrl}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
