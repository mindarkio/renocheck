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
import { assertCacheFileFresh } from "../src/lib/cause-list/cache-ttl";
import { BD_REGISTER_CSV_PATH } from "../src/lib/bd-register/paths";
import { mwcStoredNames } from "../src/lib/mwc-import-names";
import { parseBdRegistryExpiryDate } from "../src/lib/mwc-registry-display";
import { normalizeHongKongPhone } from "../src/lib/normalize-phone";

const CSV_PATH = BD_REGISTER_CSV_PATH;

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

function displayName(row: CsvRow): string {
  return mwcStoredNames(row).company_name;
}

function pickPhone(row: CsvRow): string | null {
  return normalizeHongKongPhone(row.TELEPHONE_NO);
}

function stripHtml(s: string): string {
  return s.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

function pickPrimarySignatory(row: CsvRow): string | null {
  const zh = stripHtml(row.AS_NAME_CHINESE ?? "");
  const en = stripHtml(row.AS_NAME_ENGLISH ?? "");
  return zh || en || null;
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

  await assertCacheFileFresh(CSV_PATH, "BD registers CSV (run pnpm bd-register:fetch)");
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

  const records = deduped.map((row) => {
    const names = mwcStoredNames(row);
    return {
      company_name: names.company_name,
      company_name_en: names.company_name_en,
      phone: pickPhone(row),
      registration_no: row.REGISTRATION_NUMBER.trim(),
      expiry_date: parseBdRegistryExpiryDate(row.EXPIRY_DATE ?? ""),
      primary_signatory_name: pickPrimarySignatory(row),
      source_updated_at: sourceUpdatedAt,
    };
  });

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
