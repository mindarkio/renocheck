/**
 * MWC BR + lookup alias suggestions for judgments-seed.local.json
 *
 *   pnpm enrich:judgments-seed          # report only
 *   pnpm enrich:judgments-seed --write  # update seed file
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeLookupAliases,
  suggestLookupAliases,
} from "../src/lib/judgment-lookup-match";
import { lookupMwcWithMeta } from "../src/lib/mwc-lookup";
import {
  brNormalizedFromSeedField,
  normalizeBrDigits,
} from "../src/lib/normalize-br";

const SEED_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgments-seed.local.json",
);

type SeedRow = {
  caseRef: string;
  companyNameNormalized: string;
  partyNames?: string[];
  brNormalized?: string;
  lookupAliases?: string[];
};

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
  const write = process.argv.includes("--write");
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const rows = JSON.parse(readFileSync(SEED_PATH, "utf8")) as SeedRow[];
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report: Array<Record<string, unknown>> = [];
  const out: SeedRow[] = [];

  for (const row of rows) {
    const suggested = suggestLookupAliases(
      row.companyNameNormalized,
      row.partyNames,
    );
    const manual = row.lookupAliases ?? [];
    const mergedLabels = [...new Set([...suggested, ...manual])];
    const normalizedAliases = normalizeLookupAliases(
      row.companyNameNormalized,
      mergedLabels,
    );

    const mwc = await lookupMwcWithMeta(supabase, {
      companyName: row.companyNameNormalized,
    });
    let brNormalized = brNormalizedFromSeedField(row.brNormalized);
    const mwcAliases: string[] = [];
    if (mwc.row && !mwc.ambiguous) {
      mwcAliases.push(mwc.row.company_name);
      const fakeBrFromReg = normalizeBrDigits(mwc.row.registration_no);
      if (fakeBrFromReg && brNormalized === fakeBrFromReg) {
        brNormalized = undefined;
      }
    }

    const lookupAliases = normalizeLookupAliases(row.companyNameNormalized, [
      ...mergedLabels,
      ...mwcAliases,
    ]);

    report.push({
      caseRef: row.caseRef,
      companyNameNormalized: row.companyNameNormalized,
      mwcHit: !!mwc.row,
      mwcAmbiguous: mwc.ambiguous,
      mwcCompany: mwc.row?.company_name ?? null,
      brNormalized: brNormalized ?? null,
      suggested,
      lookupAliasesStored: lookupAliases,
    });

    const { brNormalized: _oldBr, ...rest } = row;
    out.push({
      ...rest,
      ...(brNormalized ? { brNormalized } : {}),
      lookupAliases: mergedLabels.length ? mergedLabels : undefined,
    });
  }

  console.info(JSON.stringify({ event: "enrich_judgments_seed_report", report }, null, 2));

  if (write) {
    writeFileSync(SEED_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
    console.info(
      JSON.stringify({ event: "enrich_judgments_seed_written", path: SEED_PATH }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
