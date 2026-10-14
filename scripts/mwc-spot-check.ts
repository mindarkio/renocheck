/**
 * P2-C0: Check whether fixture company names exist in mwc_contractors.
 *
 * Usage: pnpm mwc:spot-check
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { mwcCompanyNameLookupTerms } from "../src/lib/mwc-company-search-terms";

const FIXTURES = resolve(
  process.cwd(),
  "scripts/fixtures/search-evidence.json",
);

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("需要 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key);
  const { count, error: countErr } = await sb
    .from("mwc_contractors")
    .select("*", { count: "exact", head: true });
  if (countErr) {
    console.error(countErr.message);
    process.exit(1);
  }
  console.log(`mwc_contractors rows: ${count ?? "?"}\n`);

  const fixtures = JSON.parse(readFileSync(FIXTURES, "utf8")) as {
    cases: Array<{ id: string; companyName?: string }>;
  };

  for (const c of fixtures.cases) {
    if (!c.companyName) continue;
    const terms = mwcCompanyNameLookupTerms(c.companyName);
    let hits: Array<{ company_name: string; phone: string | null }> = [];
    for (const term of terms) {
      const { data } = await sb
        .from("mwc_contractors")
        .select("company_name, phone")
        .ilike("company_name", `%${term}%`)
        .limit(3);
      if (data?.length) {
        hits = data;
        break;
      }
    }
    const status = hits.length ? `hit (${hits[0].company_name})` : "no hit";
    console.log(`${c.id}: ${status}`);
    if (hits.length > 1) {
      console.log(`  (${hits.length} candidates for term)`);
    }
  }

  console.log("\n輝煌 smoke phone (名冊驗證):");
  const { data: fei } = await sb
    .from("mwc_contractors")
    .select("company_name, phone")
    .ilike("company_name", "%輝煌設計工程%")
    .limit(1)
    .maybeSingle();
  if (fei?.phone) {
    console.log(`  phone ${fei.phone} → ${fei.company_name}`);
  } else {
    console.log("  （輝煌未找到，請更新文檔）");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
