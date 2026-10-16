/**
 * Browser-probe LRS JU hit counts for candidate keywords (ops).
 *
 *   pnpm lrs:probe-keywords
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildLrsDualFieldSearchResultUrl,
  buildLrsSearchResultUrl,
} from "../src/lib/lrs-search-url";
import { parseLrsSearchResultMeta } from "../src/lib/parse-lrs-search-html";
import { fetchLrsSearchPageHtml, sleep } from "./lib/lrs-playwright-fetch";

const OUT = resolve(process.cwd(), "scripts/output/lrs-keyword-probe.json");

const PHRASES: Array<{ id: string; keyword: string }> = [
  { id: "phrase-裝修公司", keyword: "裝修公司" },
  { id: "phrase-工程款", keyword: "工程款" },
  { id: "phrase-按金", keyword: "按金" },
  { id: "phrase-爛尾", keyword: "爛尾" },
  { id: "phrase-水電工程", keyword: "水電工程" },
  { id: "phrase-違約", keyword: "違約" },
  { id: "phrase-欠款", keyword: "欠款" },
  { id: "phrase-維修工程", keyword: "維修工程" },
  { id: "phrase-判頭", keyword: "判頭" },
  { id: "phrase-水電", keyword: "水電" },
  { id: "phrase-冷氣", keyword: "冷氣" },
  { id: "phrase-浴室", keyword: "浴室" },
  { id: "phrase-廚櫃", keyword: "廚櫃" },
  { id: "phrase-油漆", keyword: "油漆" },
  { id: "phrase-防水", keyword: "防水" },
  { id: "phrase-拆卸", keyword: "拆卸" },
  { id: "phrase-室內設計", keyword: "室內設計" },
  { id: "anywords-interior", keyword: "interior" },
  { id: "anywords-renovation", keyword: "renovation" },
  { id: "phrase-fitting-out", keyword: "fitting out" },
  { id: "phrase-decoration-contract", keyword: "decoration contract" },
  { id: "anywords-contractor", keyword: "contractor" },
  { id: "anywords-workmanship", keyword: "workmanship" },
];

const DUAL: Array<{ id: string; a: string; b: string }> = [
  { id: "hca-裝修", a: "HCA", b: "裝修" },
  { id: "cacv-裝修", a: "CACV", b: "裝修" },
  { id: "hca-工程合約", a: "HCA", b: "工程合約" },
  { id: "dccj-工程款", a: "DCCJ", b: "工程款" },
];

async function main() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results: Array<Record<string, unknown>> = [];

  for (const p of PHRASES) {
    const url = buildLrsSearchResultUrl({
      keyword: p.keyword,
      mode: p.id.startsWith("phrase") ? "phrase" : "anywords",
    });
    const html = await fetchLrsSearchPageHtml(page, url);
    results.push({
      id: p.id,
      type: "phrase",
      keyword: p.keyword,
      url,
      hitsJu: parseLrsSearchResultMeta(html).resultCount,
    });
    await sleep(2000);
  }

  for (const d of DUAL) {
    const url = buildLrsDualFieldSearchResultUrl({
      txtSearch: d.a,
      txtSearch2: d.b,
    });
    const html = await fetchLrsSearchPageHtml(page, url);
    results.push({
      id: d.id,
      type: "dual",
      txtSearch: d.a,
      txtSearch2: d.b,
      url,
      hitsJu: parseLrsSearchResultMeta(html).resultCount,
    });
    await sleep(2000);
  }

  await browser.close();
  mkdirSync(resolve(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(
    OUT,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
    "utf8",
  );
  console.info(JSON.stringify({ event: "lrs_probe_keywords_done", path: OUT, results }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
