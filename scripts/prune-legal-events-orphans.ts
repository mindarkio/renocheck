/**
 * Delete official_legal_events rows (legalref batch) whose case_ref is not in local seed.
 *
 *   pnpm prune:legal-events-orphans --dry-run
 *   pnpm prune:legal-events-orphans
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEED_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgments-seed.local.json",
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

function normRef(r: string): string {
  return r.replace(/\s+/g, "").toUpperCase();
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as Array<{
    caseRef: string;
  }>;
  const allowed = new Set(seed.map((r) => normRef(r.caseRef)));

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

  const { data, error } = await supabase
    .from("official_legal_events")
    .select("id, case_ref, source_catalog_id")
    .eq("source_catalog_id", "legalref-lrs-ju");

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const orphans =
    data?.filter((r) => !allowed.has(normRef(r.case_ref as string))) ?? [];

  console.info(
    JSON.stringify({
      event: "prune_legal_events_orphans_matched",
      seedCases: allowed.size,
      orphans: orphans.length,
      dryRun,
    }),
  );

  if (dryRun || orphans.length === 0) return;

  const ids = orphans.map((r) => r.id);
  const { error: delErr } = await supabase
    .from("official_legal_events")
    .delete()
    .in("id", ids);
  if (delErr) {
    console.error(delErr);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
