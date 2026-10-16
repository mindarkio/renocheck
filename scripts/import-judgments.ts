/**
 * Import court judgment seed rows into official_legal_events (DEC-0012).
 *
 * Usage: pnpm import:judgments [--dry-run] [--file path/to/seed.json]
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeCompanyNameForCompare } from "../src/lib/entity-report-context";
import {
  normalizeLookupAliases,
  suggestLookupAliases,
} from "../src/lib/judgment-lookup-match";
import { brNormalizedFromSeedField } from "../src/lib/normalize-br";

const DEFAULT_SEED = resolve(
  process.cwd(),
  "scripts/fixtures/judgments-seed.json",
);

type SeedRow = {
  sourceType?: string;
  sourceCatalogId: string;
  caseRef: string;
  court: string;
  eventDate: string;
  partyNames?: string[];
  brNormalized?: string;
  companyNameNormalized: string;
  judgmentCategory: string;
  partyRole: string;
  outcomeHint?: string;
  procedureStage?: string;
  hearingKeyPointsZh: string[];
  sourceUrl: string;
  sourcePublishedAt?: string;
  renovationRelevant?: boolean;
  topicTags?: string[];
  lookupAliases?: string[];
  reviewStatus?: "auto" | "human_verified";
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

function contentHash(row: SeedRow): string {
  const payload = JSON.stringify({
    caseRef: row.caseRef,
    sourceUrl: row.sourceUrl,
    eventDate: row.eventDate,
    companyNameNormalized: row.companyNameNormalized,
    judgmentCategory: row.judgmentCategory,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function toDbRow(row: SeedRow) {
  const company = normalizeCompanyNameForCompare(row.companyNameNormalized);
  const br = brNormalizedFromSeedField(row.brNormalized);
  const aliasExtras = [
    ...suggestLookupAliases(row.companyNameNormalized, row.partyNames),
    ...(row.lookupAliases ?? []),
  ];
  const lookup_aliases = normalizeLookupAliases(
    row.companyNameNormalized,
    aliasExtras,
  );
  return {
    source_type: row.sourceType ?? "court_judgment",
    source_catalog_id: row.sourceCatalogId,
    case_ref: row.caseRef,
    court: row.court,
    event_date: row.eventDate,
    party_names: row.partyNames ?? [row.companyNameNormalized],
    hearing_key_points_zh: row.hearingKeyPointsZh,
    source_url: row.sourceUrl,
    source_published_at: row.sourcePublishedAt ?? null,
    br_normalized: br ?? null,
    company_name_normalized: company,
    lookup_aliases,
    judgment_category: row.judgmentCategory,
    party_role: row.partyRole,
    outcome_hint: row.outcomeHint ?? null,
    procedure_stage: row.procedureStage ?? null,
    renovation_relevant: row.renovationRelevant ?? true,
    topic_tags: row.topicTags ?? [],
    source_content_hash: contentHash(row),
    review_status: row.reviewStatus ?? "auto",
  };
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  const seedPath = fileArg
    ? resolve(process.cwd(), fileArg.slice("--file=".length))
    : DEFAULT_SEED;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const raw = readFileSync(seedPath, "utf8");
  const rows = JSON.parse(raw) as SeedRow[];
  const dbRows = rows.map(toDbRow);

  if (dryRun) {
    console.info(JSON.stringify({ event: "import_judgments_dry_run", count: dbRows.length }));
    return;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase
    .from("official_legal_events")
    .upsert(dbRows, { onConflict: "source_content_hash" });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.info(
    JSON.stringify({ event: "import_judgments_ok", count: dbRows.length, seed: seedPath }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
