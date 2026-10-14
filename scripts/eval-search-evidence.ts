/**
 * Compare Serp query strategies against fixtures (dev only).
 *
 * Usage: pnpm eval:search-evidence
 * Env: SERPER_API_KEY or SERPAPI_KEY in .env.local; optional GOOGLE_CSE_* for CSE column
 * Prod column uses serpPageCount() (same as API). Q1/Q2 use EVAL_SERP_PAGES (default 1).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  entityL1MustIncludeAny,
  entityMatchTokens,
} from "../src/lib/search-entity-labels";
import { filterWebSearchHitsForLlm } from "../src/lib/search-evidence-filter";
import { resolveAuthoritativeSearchLabel } from "../src/lib/entity-report-context";
import { normalizeHongKongPhone } from "../src/lib/normalize-phone";
import { isWebSearchConfigured } from "../src/lib/search-provider";
import {
  buildPhoneAnchorQuery,
  buildQueriesForStrategy,
  buildWebSearchQueryLooseYuanshiStyle,
  fetchSerpOrganicHits,
  fetchWebSearchHitsForEntity,
  resolveEntitySearchLabel,
  serpPageCount,
  type SearchQueryStrategyId,
  type WebSearchHit,
} from "../src/lib/web-search";

const FIXTURES_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/search-evidence.json",
);

type FixtureCase = {
  id: string;
  label: string;
  companyName?: string;
  phone?: string;
  mustIncludeInResults: string | null;
  mustExcludeTextInResults?: string;
  goldEvidenceUrls?: string[];
  goldEvidenceNote?: string;
};

type FixturesFile = {
  version: number;
  cases: FixtureCase[];
};

type EvalStrategyId = SearchQueryStrategyId | "Prod" | "Q3";

function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

function hitText(h: WebSearchHit): string {
  return `${h.title} ${h.snippet} ${h.url}`;
}

function evaluateCase(
  hits: WebSearchHit[],
  fixture: FixtureCase,
): { pass: boolean; detail: string } {
  const n = hits.length;
  if (fixture.mustExcludeTextInResults) {
    const bad = hits.some((h) =>
      hitText(h).includes(fixture.mustExcludeTextInResults!),
    );
    if (bad) {
      return { pass: false, detail: `不應出現「${fixture.mustExcludeTextInResults}」` };
    }
  }
  const goldSuffix = formatGoldEvidenceHint(hits, fixture);

  if (fixture.mustIncludeInResults) {
    const ok = hits.some((h) =>
      hitText(h).includes(fixture.mustIncludeInResults!),
    );
    return ok
      ? { pass: true, detail: `召回 OK（${n} hits）${goldSuffix}` }
      : {
          pass: false,
          detail: `未見「${fixture.mustIncludeInResults}」（${n} hits）${goldSuffix}`,
        };
  }
  return { pass: true, detail: `${n} hits（無強制召回）${goldSuffix}` };
}

function formatGoldEvidenceHint(
  hits: WebSearchHit[],
  fixture: FixtureCase,
): string {
  const gold = fixture.goldEvidenceUrls;
  if (!gold?.length) return "";
  const matched = gold.filter((g) =>
    hits.some((h) => h.url.includes(g) || hitText(h).includes(g)),
  );
  if (matched.length === 0) return "；gold URL 未命中";
  return `；gold 命中 ${matched.length}/${gold.length}`;
}

async function fetchCseHits(query: string): Promise<WebSearchHit[]> {
  const key = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_CX?.trim();
  if (!key || !cx) return [];

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: "10",
    hl: "zh-HK",
    gl: "hk",
  });
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (json.items ?? []).map((item) => ({
    title: item.title ?? "",
    url: item.link ?? "",
    snippet: (item.snippet ?? "").slice(0, 280),
  }));
}

async function runLegacyStrategy(
  fixture: FixtureCase,
  strategy: SearchQueryStrategyId,
): Promise<WebSearchHit[]> {
  const input = {
    companyName: fixture.companyName,
    phone: fixture.phone,
  };
  const queries = buildQueriesForStrategy(strategy, input);
  const evalPages = Number(process.env.EVAL_SERP_PAGES ?? "1");
  const batches: WebSearchHit[][] = [];
  for (const q of queries) {
    batches.push(await fetchSerpOrganicHits(q, { pages: evalPages }));
  }
  const seen = new Set<string>();
  const merged: WebSearchHit[] = [];
  for (const h of batches.flat()) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    merged.push(h);
  }
  return merged;
}

async function runProdStrategy(fixture: FixtureCase): Promise<WebSearchHit[]> {
  const input = {
    companyName: fixture.companyName,
    phone: fixture.phone,
  };
  const phoneForL1 = normalizeHongKongPhone(fixture.phone) ?? undefined;
  const searchLabel = resolveAuthoritativeSearchLabel(input);
  const { hits: raw } = await fetchWebSearchHitsForEntity(input);
  const tokens = entityMatchTokens(input, { phoneNormalized: phoneForL1 });
  return filterWebSearchHitsForLlm(raw, tokens, {
    normalizedPhone: phoneForL1,
    mustIncludeAny: entityL1MustIncludeAny(searchLabel),
  });
}

async function runQ3Strategy(fixture: FixtureCase): Promise<WebSearchHit[]> {
  const phone = normalizeHongKongPhone(fixture.phone);
  const evalPages = Number(process.env.EVAL_SERP_PAGES ?? "1");
  if (phone) {
    const q = buildPhoneAnchorQuery(phone);
    return fetchSerpOrganicHits(q, { pages: evalPages });
  }
  const label = resolveEntitySearchLabel({
    companyName: fixture.companyName,
    phone: fixture.phone,
  });
  if (!label) return [];
  const q = buildWebSearchQueryLooseYuanshiStyle(label);
  return fetchSerpOrganicHits(q, { pages: evalPages });
}

async function runStrategy(
  fixture: FixtureCase,
  strategy: EvalStrategyId,
): Promise<WebSearchHit[]> {
  if (strategy === "Prod") return runProdStrategy(fixture);
  if (strategy === "Q3") return runQ3Strategy(fixture);
  return runLegacyStrategy(fixture, strategy);
}

async function main() {
  loadEnvLocal();
  if (!isWebSearchConfigured()) {
    console.error("需要 SERPER_API_KEY 或 SERPAPI_KEY（.env.local）");
    process.exit(1);
  }

  const fixtures = JSON.parse(
    readFileSync(FIXTURES_PATH, "utf8"),
  ) as FixturesFile;

  const legacyStrategies: SearchQueryStrategyId[] = ["Q1", "Q2", "Q1+Q2"];
  const strategies: EvalStrategyId[] = ["Prod", ...legacyStrategies, "Q3"];
  const hasCse =
    Boolean(process.env.GOOGLE_CSE_API_KEY?.trim()) &&
    Boolean(process.env.GOOGLE_CSE_CX?.trim());

  console.log(
    `Search evidence eval — Prod uses serpPageCount=${serpPageCount()}; legacy Q1/Q2 use EVAL_SERP_PAGES=${process.env.EVAL_SERP_PAGES ?? "1"}\n`,
  );

  const summary: Record<string, Record<string, boolean>> = {};

  for (const fixture of fixtures.cases) {
    console.log(`── ${fixture.id}: ${fixture.label}`);
    summary[fixture.id] = {};

    for (const strategy of strategies) {
      const label =
        strategy === "Prod"
          ? "Prod  "
          : strategy === "Q3"
            ? "Q3    "
            : `${strategy.padEnd(6)}`;
      try {
        const hits = await runStrategy(fixture, strategy);
        const { pass, detail } = evaluateCase(hits, fixture);
        summary[fixture.id][strategy] = pass;
        console.log(`  ${label} ${pass ? "✓" : "✗"}  ${detail}`);
      } catch (e) {
        summary[fixture.id][strategy] = false;
        console.log(`  ${label} ✗  Serp 失敗：${String(e).slice(0, 80)}`);
      }
    }

    if (hasCse) {
      const q = buildQueriesForStrategy("Q2", {
        companyName: fixture.companyName,
        phone: fixture.phone,
      })[0];
      const hits = await fetchCseHits(q);
      const { pass, detail } = evaluateCase(hits, fixture);
      summary[fixture.id].CSE = pass;
      console.log(`  CSE    ${pass ? "✓" : "✗"}  ${detail}`);
    }

    console.log("");
  }

  if (!hasCse) {
    console.log("（未設 GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX，跳過 CSE 欄）\n");
  }

  console.log("── 策略得分（mustInclude 案例）");
  for (const strategy of ["Prod", ...legacyStrategies] as EvalStrategyId[]) {
    const scored = fixtures.cases.filter((c) => c.mustIncludeInResults);
    const wins = scored.filter((c) => summary[c.id][strategy]).length;
    console.log(`  ${strategy}: ${wins}/${scored.length} 召回`);
  }
  console.log("  Q3: （實驗欄，不計入 Prod 必達）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
