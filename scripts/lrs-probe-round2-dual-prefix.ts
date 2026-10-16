/**
 * Probe dual-field (court prefix + keyword) hits for round-2 crawl planning.
 *
 *   pnpm lrs:probe-round2-dual
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseLrsSearchResultMeta } from "../src/lib/parse-lrs-search-html";
import { buildLrsDualFieldSearchResultUrl } from "../src/lib/lrs-search-url";
import { fetchLrsSearchPageHtml, sleep } from "./lib/lrs-playwright-fetch";

const OUT = resolve(
  process.cwd(),
  "scripts/output/lrs-round2-dual-prefix-probe.json",
);

const PREFIXES = ["DCCJ", "HCA", "LDPD", "HCSA"] as const;
const KEYWORDS = [
  { id: "水電", keyword: "水電" },
  { id: "冷氣", keyword: "冷氣" },
  { id: "油漆", keyword: "油漆" },
  { id: "interior", keyword: "interior" },
] as const;

async function main() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results: Array<Record<string, unknown>> = [];

  for (const kw of KEYWORDS) {
    for (const prefix of PREFIXES) {
      const id = `${prefix.toLowerCase()}-${kw.id}`;
      const url = buildLrsDualFieldSearchResultUrl({
        txtSearch: prefix,
        txtSearch2: kw.keyword,
      });
      const html = await fetchLrsSearchPageHtml(page, url);
      const hitsJu = parseLrsSearchResultMeta(html).resultCount;
      results.push({ id, prefix, keyword: kw.keyword, url, hitsJu });
      await sleep(2000);
    }
  }

  await browser.close();
  mkdirSync(resolve(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(
    OUT,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
    "utf8",
  );
  console.info(JSON.stringify({ event: "lrs_probe_round2_dual_done", path: OUT, results }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
