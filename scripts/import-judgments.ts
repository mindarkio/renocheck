/**
 * Import court judgment seed rows into official_legal_events (DEC-0012).
 *
 * Usage: pnpm import:judgments --file=path/to/seed.json [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertJudgmentSeedAllowedForRemoteImport } from "../src/lib/judgment-import-catalog-guard";
import { officialLegalEventSourceCatalogAllowlistValues } from "../src/lib/legal-event-catalog-allowlist";
import { judgmentCaseRefStorageDrift } from "../src/lib/judgment-case-ref";
import {
  buildJudgmentImportDbRow,
  type ExistingJudgmentHearingRow,
  type JudgmentSeedRow,
  judgmentImportRowKey,
} from "../src/lib/judgment-import-row";

const EXISTING_PAGE_SIZE = 1000;

const EXISTING_HEARING_SELECT =
  "source_catalog_id, case_ref, source_content_hash, hearing_key_points_zh, hearing_key_point_quotes_zh, hearing_points_source, outcome_hint, review_status";

const EXISTING_FULL_SELECT =
  "source_type, source_catalog_id, case_ref, court, event_date, party_names, hearing_key_points_zh, hearing_key_point_quotes_zh, hearing_points_source, source_url, source_published_at, br_normalized, company_name_normalized, lookup_aliases, judgment_category, party_role, outcome_hint, procedure_stage, renovation_relevant, topic_tags, source_content_hash, review_status";

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function importRowWouldChange(
  built: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
): boolean {
  if (!existing) return true;
  for (const key of Object.keys(built)) {
    if (stableJson(built[key]) !== stableJson(existing[key])) return true;
  }
  return false;
}

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

function requireSeedFileArg(): string {
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  if (!fileArg) {
    console.error(
      JSON.stringify({
        event: "import_judgments_usage",
        hint:
          "pnpm import:judgments --file=scripts/fixtures/judgments-seed.local.json [--dry-run]",
      }),
    );
    process.exit(1);
  }
  return resolve(process.cwd(), fileArg.slice("--file=".length));
}

async function fetchExistingByCatalogCase(
  supabase: ReturnType<typeof createClient>,
  catalogIds: string[],
  select: string,
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const catalogId of catalogIds) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("official_legal_events")
        .select(select)
        .eq("source_catalog_id", catalogId)
        .order("id", { ascending: true })
        .range(from, from + EXISTING_PAGE_SIZE - 1);
      if (error) throw error;
      const batch = data ?? [];
      for (const row of batch) {
        const key = judgmentImportRowKey(
          row.source_catalog_id as string,
          row.case_ref as string,
        );
        map.set(key, row as Record<string, unknown>);
      }
      if (batch.length < EXISTING_PAGE_SIZE) break;
      from += EXISTING_PAGE_SIZE;
    }
  }
  return map;
}

type CaseRefDriftRow = {
  id: string;
  source_catalog_id: string;
  stored: string;
  normalized: string;
};

export async function auditRemoteJudgmentCaseRefNormalization(
  supabase: ReturnType<typeof createClient>,
): Promise<{ rowCount: number; drifts: CaseRefDriftRow[] }> {
  const drifts: CaseRefDriftRow[] = [];
  let rowCount = 0;
  for (const catalogId of officialLegalEventSourceCatalogAllowlistValues()) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("official_legal_events")
        .select("id, case_ref, source_catalog_id")
        .eq("source_catalog_id", catalogId)
        .order("id", { ascending: true })
        .range(from, from + EXISTING_PAGE_SIZE - 1);
      if (error) throw error;
      const batch = data ?? [];
      rowCount += batch.length;
      for (const row of batch) {
        const stored = row.case_ref as string;
        const { normalized, changed } = judgmentCaseRefStorageDrift(stored);
        if (changed) {
          drifts.push({
            id: row.id as string,
            source_catalog_id: row.source_catalog_id as string,
            stored,
            normalized,
          });
        }
      }
      if (batch.length < EXISTING_PAGE_SIZE) break;
      from += EXISTING_PAGE_SIZE;
    }
  }
  return { rowCount, drifts };
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const seedPath = requireSeedFileArg();

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const remoteAudit = await auditRemoteJudgmentCaseRefNormalization(supabase);
  console.info(
    JSON.stringify({
      event: "import_judgments_remote_case_ref_audit",
      rowCount: remoteAudit.rowCount,
      driftCount: remoteAudit.drifts.length,
      dryRun,
    }),
  );
  if (remoteAudit.drifts.length > 0) {
    console.error(
      JSON.stringify({
        event: "import_judgments_remote_case_ref_drift_blocked",
        drifts: remoteAudit.drifts,
        hint:
          "Fix official_legal_events.case_ref on remote before import (normalize to court prefix + space + number/year).",
      }),
    );
    process.exit(1);
  }

  const raw = readFileSync(seedPath, "utf8");
  const rows = JSON.parse(raw) as JudgmentSeedRow[];
  try {
    assertJudgmentSeedAllowedForRemoteImport(rows);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({ event: "import_judgments_blocked", error: message }),
    );
    process.exit(1);
  }

  const catalogIds = [...new Set(rows.map((r) => r.sourceCatalogId))];
  const existingByKey = await fetchExistingByCatalogCase(
    supabase,
    catalogIds,
    dryRun ? EXISTING_FULL_SELECT : EXISTING_HEARING_SELECT,
  );

  const dbRows: ReturnType<typeof buildJudgmentImportDbRow>[] = [];
  let preservedHearing = 0;
  let wouldChange = 0;
  const changedCaseRefs: string[] = [];
  for (const row of rows) {
    try {
      const rowKey = judgmentImportRowKey(row.sourceCatalogId, row.caseRef);
      const existing = existingByKey.get(rowKey) as
        | ExistingJudgmentHearingRow
        | undefined;
      const built = buildJudgmentImportDbRow(row, existing);
      if (dryRun && importRowWouldChange(built, existingByKey.get(rowKey))) {
        wouldChange += 1;
        changedCaseRefs.push(built.case_ref);
      }
      if (
        existing?.hearing_points_source === "ai_verified" ||
        existing?.hearing_points_source === "manual"
      ) {
        preservedHearing += 1;
      }
      dbRows.push(built);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        JSON.stringify({
          event: "import_judgments_row_failed",
          caseRef: row.caseRef,
          error: message,
        }),
      );
      process.exit(1);
    }
  }

  if (dryRun) {
    console.info(
      JSON.stringify({
        event: "import_judgments_dry_run",
        count: dbRows.length,
        wouldChange,
        unchanged: dbRows.length - wouldChange,
        preservedHearing,
        upsertOn: "source_catalog_id,case_ref",
        ...(changedCaseRefs.length ? { changedCaseRefs } : {}),
      }),
    );
    if (wouldChange > 0) process.exit(1);
    return;
  }

  const { error: upsertErr } = await supabase
    .from("official_legal_events")
    .upsert(dbRows, { onConflict: "source_catalog_id,case_ref" });

  if (upsertErr) {
    console.error(upsertErr);
    process.exit(1);
  }

  console.info(
    JSON.stringify({
      event: "import_judgments_ok",
      count: dbRows.length,
      preservedHearing,
      seed: seedPath,
      upsertOn: "source_catalog_id,case_ref",
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
