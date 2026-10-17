/**
 * Import court judgment seed rows into official_legal_events (DEC-0012).
 *
 * Usage: pnpm import:judgments [--dry-run] [--file path/to/seed.json]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildJudgmentImportDbRow,
  type JudgmentSeedRow,
  judgmentSeedContentHash,
} from "../src/lib/judgment-import-row";

const DEFAULT_SEED = resolve(
  process.cwd(),
  "scripts/fixtures/judgments-seed.json",
);

const EXISTING_SELECT =
  "source_content_hash, hearing_key_points_zh, hearing_key_point_quotes_zh, hearing_points_source, outcome_hint, review_status";

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
  const rows = JSON.parse(raw) as JudgmentSeedRow[];
  const hashes = rows.map((r) => judgmentSeedContentHash(r));

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const existingByHash = new Map<
    string,
    {
      hearing_key_points_zh: unknown;
      hearing_key_point_quotes_zh?: unknown;
      hearing_points_source: string | null;
      outcome_hint?: string | null;
      review_status?: string | null;
    }
  >();

  if (!dryRun && hashes.length > 0) {
    const { data, error } = await supabase
      .from("official_legal_events")
      .select(EXISTING_SELECT)
      .in("source_content_hash", hashes);
    if (error) {
      console.error(error);
      process.exit(1);
    }
    for (const row of data ?? []) {
      const h = row.source_content_hash as string;
      existingByHash.set(h, row);
    }
  }

  const dbRows: ReturnType<typeof buildJudgmentImportDbRow>[] = [];
  let preservedHearing = 0;
  for (const row of rows) {
    try {
      const hash = judgmentSeedContentHash(row);
      const existing = existingByHash.get(hash);
      const built = buildJudgmentImportDbRow(row, existing);
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
        preservedHearing,
      }),
    );
    return;
  }

  const { error: upsertErr } = await supabase
    .from("official_legal_events")
    .upsert(dbRows, { onConflict: "source_content_hash" });

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
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
