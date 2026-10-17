/**
 * 人手核對名冊搜尋（LTD/LIMITED、&amp;、空格等）。
 *
 *   pnpm mwc:registry-manual-probe
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { mwcCompanyNameLookupTerms } from "../src/lib/mwc-company-search-terms";
import { normalizeCompanyNameForCompare } from "../src/lib/entity-report-context";

const QUERIES = [
  "SING YU DECORATION",
  "DAVID DECORATION",
  "JINGO INTERIORS",
  "聯階裝飾",
  "順達家居設計工程",
];

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

async function main() {
  loadEnvLocal();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const query of QUERIES) {
    const terms = mwcCompanyNameLookupTerms(query);
    const hits: Array<{ company_name: string; term: string }> = [];
    const seen = new Set<string>();

    for (const term of terms) {
      const { data } = await supabase
        .from("mwc_contractors")
        .select("company_name")
        .ilike("company_name", `%${term}%`)
        .limit(5);
      for (const row of data ?? []) {
        const key = row.company_name as string;
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push({ company_name: key, term });
      }
    }

    const normQuery = normalizeCompanyNameForCompare(query);
    const normHit = hits.find((h) => {
      const n = normalizeCompanyNameForCompare(h.company_name);
      return (
        n.includes(normQuery) ||
        normQuery.includes(n) ||
        n === normQuery
      );
    });

    results.push({
      query,
      lookupTermsTried: terms.slice(0, 12),
      hitCount: hits.length,
      found: hits.length > 0,
      normalizedSubstringMatch: !!normHit,
      sampleHits: hits.slice(0, 5),
      note:
        hits.length === 0
          ? "名冊 ilike 零命中 — 可能未登記、商號用字不同，或需中英括號全名"
          : normHit
            ? "有命中；normalize 後可與查詢互相包含"
            : "有寬鬆 ilike 命中但 normalize 未對上 — 檢查 LTD/LIMITED、空格、英文全名",
    });
  }

  console.info(JSON.stringify({ event: "mwc_registry_manual_probe", results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
