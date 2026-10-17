import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { extractMwcBilingualNames } from "../mwc-bilingual-company-names";
import { assertCacheFileFresh } from "./cache-ttl";
import type { CauseListCompanyFixture } from "./fixtures/companies.fixture";

export type MwcSnapshotRow = {
  registration_no: string;
  company_name: string;
};

function rowToFixture(row: MwcSnapshotRow): CauseListCompanyFixture {
  const bi = extractMwcBilingualNames(row.company_name);
  const namesEn: string[] = [];
  const namesZh: string[] = [];
  const aliasesEn: string[] = [];
  const aliasesZh: string[] = [];

  if (bi.en) namesEn.push(bi.en);
  if (bi.zh) namesZh.push(bi.zh);
  if (!bi.en && !bi.zh && bi.combined) {
    if (/[\u4e00-\u9fff]/u.test(bi.combined)) namesZh.push(bi.combined);
    else namesEn.push(bi.combined);
  }
  if (bi.combined && (bi.en || bi.zh)) {
    if (/[\u4e00-\u9fff]/u.test(bi.combined)) aliasesZh.push(bi.combined);
    else aliasesEn.push(bi.combined);
  }

  return {
    id: row.registration_no || `mwc-${bi.combined.slice(0, 16)}`,
    namesEn,
    namesZh,
    aliasesEn: aliasesEn.length ? aliasesEn : undefined,
    aliasesZh: aliasesZh.length ? aliasesZh : undefined,
  };
}

export async function loadVerifyCompanyRegistry(): Promise<CauseListCompanyFixture[]> {
  const envPath = process.env.CAUSE_LIST_VERIFY_COMPANIES_JSON?.trim();
  const defaultPath = path.join(
    process.cwd(),
    ".cache",
    "cause-list",
    "mwc-companies-verify.json",
  );
  const jsonPath = envPath || defaultPath;
  try {
    await assertCacheFileFresh(jsonPath, "MWC verify snapshot");
    const raw = await readFile(jsonPath, "utf8");
    const rows = JSON.parse(raw) as MwcSnapshotRow[];
    return rows.map(rowToFixture).filter((f) => f.namesEn.length || f.namesZh.length);
  } catch {
    // fall through to Supabase when snapshot missing
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Missing company registry: set CAUSE_LIST_VERIFY_COMPANIES_JSON or run pnpm cause-list:export-mwc",
    );
  }

  const supabase = createClient(url, key);
  const pageSize = 1000;
  let from = 0;
  const rows: MwcSnapshotRow[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("mwc_contractors")
      .select("registration_no, company_name")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as MwcSnapshotRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows.map(rowToFixture).filter((f) => f.namesEn.length || f.namesZh.length);
}
