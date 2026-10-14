/**
 * Import MWC / MWC(W) rows from BD registers CSV into mwc_contractors.
 *
 * Usage: pnpm import:mwc
 * Requires: SUPABASE_SERVICE_ROLE_KEY (+ optional NEXT_PUBLIC_SUPABASE_URL) in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeHongKongPhone } from "../src/lib/normalize-phone";

const CSV_PATH = resolve(
  process.cwd(),
  "docs/sourcedata/registers_full_list.csv",
);

const MWC_TYPES = new Set(["MWC", "MWC(W)"]);

type CsvRow = Record<string, string>;

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
    // .env.local optional if vars already exported
  }
}

function stripHtml(s: string): string {
  return s.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

function displayName(row: CsvRow): string {
  const parts = [
    row.CHINESE_COMPANY_NAME,
    row.ENGLISH_COMPANY_NAME,
    row.CHINESE_NAME,
    row.ENGLISH_NAME,
  ]
    .map((p) => stripHtml(p ?? ""))
    .filter(Boolean);
  return parts[0] ?? row.REGISTRATION_NUMBER ?? "Unknown";
}

function pickPhone(row: CsvRow): string | null {
  return normalizeHongKongPhone(row.TELEPHONE_NO);
}

function dedupeRows(rows: CsvRow[]): CsvRow[] {
  const byReg = new Map<string, CsvRow>();

  for (const row of rows) {
    const reg = row.REGISTRATION_NUMBER?.trim();
    if (!reg) continue;

    const existing = byReg.get(reg);
    if (!existing) {
      byReg.set(reg, row);
      continue;
    }
    // Prefer row with phone, else longer display name
    const hasPhone = Boolean(pickPhone(row));
    const existingHasPhone = Boolean(pickPhone(existing));
    if (hasPhone && !existingHasPhone) {
      byReg.set(reg, row);
      continue;
    }
    if (displayName(row).length > displayName(existing).length) {
      byReg.set(reg, row);
    }
  }

  return [...byReg.values()];
}

async function main() {
  loadEnvLocal();

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    "https://lvrasvtilgzwtfsfjbzd.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const csvText = readFileSync(CSV_PATH, "utf8");
  const allRows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  }) as CsvRow[];

  const mwcRows = allRows.filter((r) =>
    MWC_TYPES.has((r.REGISTRATION_TYPE ?? "").trim()),
  );
  const deduped = dedupeRows(mwcRows);

  const sourceUpdatedAt = statSync(CSV_PATH).mtime.toISOString();

  const records = deduped.map((row) => ({
    company_name: displayName(row),
    phone: pickPhone(row),
    registration_no: row.REGISTRATION_NUMBER.trim(),
    source_updated_at: sourceUpdatedAt,
  }));

  console.log(
    `CSV rows: ${allRows.length}, MWC/MWC(W): ${mwcRows.length}, deduped: ${records.length}`,
  );

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const batchSize = 500;
  let upserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from("mwc_contractors").upsert(batch, {
      onConflict: "registration_no",
    });
    if (error) {
      console.error("Upsert failed:", error.message);
      process.exit(1);
    }
    upserted += batch.length;
    console.log(`Upserted ${upserted}/${records.length}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
