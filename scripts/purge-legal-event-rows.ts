/**
 * Ops — delete mistaken import rows (PoC hygiene). Service role only.
 *
 * Usage:
 *   pnpm purge:legal-events --dry-run --company="GREEN DECOR ENGINEERING COMPANY LIMITED"
 *   pnpm purge:legal-events --company="GREEN DECOR ENGINEERING COMPANY LIMITED" --case-ref="DCCJ 1463/2017"
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeCompanyNameForCompare } from "../src/lib/entity-report-context";

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

function argValue(flag: string): string | null {
  const a = process.argv.find((x) => x.startsWith(`${flag}=`));
  return a ? a.slice(flag.length + 1) : null;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const company = argValue("--company");
  const caseRef = argValue("--case-ref");

  if (!company && !caseRef) {
    console.error(
      JSON.stringify({
        event: "purge_legal_events_usage",
        hint: "pnpm purge:legal-events --company=... [--case-ref=...]",
      }),
    );
    process.exit(1);
  }

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

  let q = supabase
    .from("official_legal_events")
    .select(
      "id, case_ref, company_name_normalized, source_content_hash, imported_at",
    );
  if (company) {
    const norm = normalizeCompanyNameForCompare(company);
    q = q.eq("company_name_normalized", norm);
  }
  if (caseRef) q = q.eq("case_ref", caseRef);

  const { data, error } = await q;
  if (error) {
    console.error(error);
    process.exit(1);
  }

  const rows = data ?? [];
  console.info(
    JSON.stringify({ event: "purge_legal_events_matched", count: rows.length, rows }),
  );

  if (dryRun || rows.length === 0) return;

  const ids = rows.map((r) => r.id);
  const { error: delErr } = await supabase
    .from("official_legal_events")
    .delete()
    .in("id", ids);
  if (delErr) {
    console.error(delErr);
    process.exit(1);
  }
  console.info(JSON.stringify({ event: "purge_legal_events_ok", deleted: ids.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
