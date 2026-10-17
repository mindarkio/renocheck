/**
 * Fetch one Daily Cause List page (live or Wayback). Raw HTML → .cache/cause-list/
 * Usage: pnpm tsx scripts/cause-list/fetch-cause-list.ts --date 16102026 --court SMT
 *        pnpm tsx scripts/cause-list/fetch-cause-list.ts --date 16102026 --court SMT --wayback 20251016120000
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LIVE_BASE =
  "https://e-services.judiciary.hk/dcl/view.jsp?lang=en&date={date}&court={court}";
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 5000;
const USER_AGENT =
  "RenocheckCauseListResearch/0.1 (+https://renocheck.homes; offline parser dev)";

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

function buildUrl(date: string, court: string, wayback?: string): string {
  const live = LIVE_BASE.replace("{date}", date).replace("{court}", court);
  if (!wayback) return live;
  return `https://web.archive.org/web/${wayback}id_/${live}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { date, court, wayback } = parseArgs(process.argv.slice(2));
  const delay =
    MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  console.info(`Waiting ${delay}ms before fetch…`);
  await sleep(delay);

  const url = buildUrl(date, court, wayback);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });
  if (!res.ok) {
    throw new Error(`fetch failed ${res.status} ${url}`);
  }
  const html = await res.text();
  const cacheDir = path.join(process.cwd(), ".cache", "cause-list");
  await mkdir(cacheDir, { recursive: true });
  const suffix = wayback ? `_wb${wayback}` : "";
  const outPath = path.join(cacheDir, `${court}_${date}${suffix}.html`);
  await writeFile(outPath, html, "utf8");
  console.info(`Wrote ${outPath} (${html.length} bytes) from ${url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
