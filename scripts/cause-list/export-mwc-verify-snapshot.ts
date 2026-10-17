/**
 * Export MWC company names to gitignored snapshot for verify-real-samples (no PII in git).
 * Usage: pnpm tsx scripts/cause-list/export-mwc-verify-snapshot.ts
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const text = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
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
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key);
  const pageSize = 1000;
  let from = 0;
  const out: Array<{ registration_no: string; company_name: string }> = [];
  while (true) {
    const { data, error } = await supabase
      .from("mwc_contractors")
      .select("registration_no, company_name")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  const cacheDir = path.join(process.cwd(), ".cache", "cause-list");
  await mkdir(cacheDir, { recursive: true });
  const outPath = path.join(cacheDir, "mwc-companies-verify.json");
  await writeFile(outPath, JSON.stringify(out), "utf8");
  console.info(`Wrote ${out.length} rows to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
