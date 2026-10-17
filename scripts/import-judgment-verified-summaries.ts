/**
 * UPDATE official_legal_events hearing summaries from verified JSON (no LLM).
 *
 *   pnpm import:judgment-verified-summaries --dry-run
 *   pnpm import:judgment-verified-summaries --apply
 *   pnpm import:judgment-verified-summaries --apply --file=scripts/output/judgment-summaries-verified.json
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canonicalVerifiedRow,
  normCaseRefKey,
  reconstructedFromDb,
  type VerifiedSummaryRow,
  verifiedRowToDbUpdate,
} from "../src/lib/judgment-verified-summaries";

const DEFAULT_FILE = resolve(
  process.cwd(),
  "scripts/fixtures/judgment-summaries-verified.json",
);
const CATALOG_ID = "legalref-lrs-ju";

const SELECT_FIELDS =
  "id, case_ref, hearing_key_points_zh, hearing_key_point_quotes_zh, outcome_hint, hearing_points_source, review_status";

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

function loadVerified(path: string): VerifiedSummaryRow[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as VerifiedSummaryRow[];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`empty or invalid verified file: ${path}`);
  }
  return raw;
}

function fieldDiff(
  expected: VerifiedSummaryRow,
  db: Record<string, unknown>,
): string[] {
  const update = verifiedRowToDbUpdate(expected);
  const diffs: string[] = [];
  const curKeys = JSON.stringify(db.hearing_key_points_zh ?? []);
  const nextKeys = JSON.stringify(update.hearing_key_points_zh);
  if (curKeys !== nextKeys) diffs.push("hearing_key_points_zh");
  const curQuotes = JSON.stringify(db.hearing_key_point_quotes_zh ?? []);
  const nextQuotes = JSON.stringify(update.hearing_key_point_quotes_zh);
  if (curQuotes !== nextQuotes) diffs.push("hearing_key_point_quotes_zh");
  if ((db.outcome_hint as string | null) !== update.outcome_hint) {
    diffs.push("outcome_hint");
  }
  if ((db.hearing_points_source as string | null) !== update.hearing_points_source) {
    diffs.push("hearing_points_source");
  }
  if ((db.review_status as string | null) !== update.review_status) {
    diffs.push("review_status");
  }
  return diffs;
}

async function main() {
  loadEnvLocal();
  const dryRun = !process.argv.includes("--apply");
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  const filePath = fileArg
    ? resolve(process.cwd(), fileArg.slice("--file=".length))
    : DEFAULT_FILE;

  const rows = loadVerified(filePath);
  const pointCounts = rows.map((r) => ({
    caseRef: r.caseRef,
    points: r.points.length,
  }));

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

  const { data: dbRows, error: selErr } = await supabase
    .from("official_legal_events")
    .select(SELECT_FIELDS)
    .eq("source_catalog_id", CATALOG_ID);

  if (selErr) {
    console.error(selErr);
    process.exit(1);
  }

  const byRef = new Map(
    (dbRows ?? []).map((r) => [normCaseRefKey(r.case_ref as string), r]),
  );

  let wouldUpdate = 0;
  let unchanged = 0;
  const missing: string[] = [];
  const planned: Array<{ caseRef: string; fields: string[] }> = [];

  for (const row of rows) {
    const key = normCaseRefKey(row.caseRef);
    const db = byRef.get(key);
    if (!db) {
      missing.push(row.caseRef);
      continue;
    }
    const fields = fieldDiff(row, db as Record<string, unknown>);
    if (fields.length === 0) {
      unchanged++;
    } else {
      wouldUpdate++;
      planned.push({ caseRef: row.caseRef, fields });
    }
  }

  console.info(
    JSON.stringify({
      event: dryRun
        ? "import_judgment_verified_summaries_dry_run"
        : "import_judgment_verified_summaries_apply_start",
      file: filePath,
      verifiedRows: rows.length,
      wouldUpdate,
      unchanged,
      missing,
      pointCounts,
    }),
  );

  if (missing.length > 0) {
    console.error(
      JSON.stringify({ event: "import_judgment_verified_summaries_missing_db", missing }),
    );
    process.exit(1);
  }

  if (dryRun) {
    if (planned.length > 0) {
      console.info(JSON.stringify({ event: "planned_updates", planned }));
    }
    return;
  }

  let updated = 0;
  for (const row of rows) {
    const key = normCaseRefKey(row.caseRef);
    const db = byRef.get(key)!;
    const fields = fieldDiff(row, db as Record<string, unknown>);
    if (fields.length === 0) continue;

    const payload = verifiedRowToDbUpdate(row);
    const { error: updErr } = await supabase
      .from("official_legal_events")
      .update(payload)
      .eq("id", db.id as string);

    if (updErr) {
      console.error(
        JSON.stringify({ event: "import_judgment_verified_summaries_update_failed", caseRef: row.caseRef, error: updErr }),
      );
      process.exit(1);
    }
    updated++;
  }

  const { data: afterRows, error: afterErr } = await supabase
    .from("official_legal_events")
    .select(SELECT_FIELDS)
    .eq("source_catalog_id", CATALOG_ID);

  if (afterErr) {
    console.error(afterErr);
    process.exit(1);
  }

  const afterByRef = new Map(
    (afterRows ?? []).map((r) => [normCaseRefKey(r.case_ref as string), r]),
  );

  const jsonDiffs: Array<{ caseRef: string; reason: string }> = [];
  for (const expected of rows) {
    const key = normCaseRefKey(expected.caseRef);
    const db = afterByRef.get(key);
    if (!db) {
      jsonDiffs.push({ caseRef: expected.caseRef, reason: "missing_after_update" });
      continue;
    }
    const rebuilt = reconstructedFromDb(expected, db as Parameters<typeof reconstructedFromDb>[1]);
    const want = canonicalVerifiedRow(expected);
    if (!rebuilt || JSON.stringify(rebuilt) !== JSON.stringify(want)) {
      jsonDiffs.push({ caseRef: expected.caseRef, reason: "canonical_mismatch" });
    }
  }

  console.info(
    JSON.stringify({
      event: "import_judgment_verified_summaries_ok",
      updated,
      unchanged,
      jsonDiffCount: jsonDiffs.length,
      pointCounts,
    }),
  );

  if (jsonDiffs.length > 0) {
    console.error(JSON.stringify({ event: "import_judgment_verified_summaries_json_diff", jsonDiffs }));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
