import { parse } from "csv-parse/sync";
import type { CauseListCompanyFixture } from "./fixtures/companies.fixture";
import { isCorporateEntityName } from "./party";

const MWC_TYPES = new Set(["MWC", "MWC(W)"]);

type RegisterRow = {
  REGISTRATION_NUMBER?: string;
  REGISTRATION_TYPE?: string;
  ENGLISH_COMPANY_NAME?: string;
  CHINESE_COMPANY_NAME?: string;
};

/**
 * Corporate MWC / MWC(W) rows from the public Buildings Department register CSV.
 * Sole-proprietor name columns are never copied into the registry.
 */
export function corporateRegistryFromRegistersCsv(
  csvText: string,
): CauseListCompanyFixture[] {
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as RegisterRow[];

  const out: CauseListCompanyFixture[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const type = (row.REGISTRATION_TYPE ?? "").trim();
    if (!MWC_TYPES.has(type)) continue;
    const id = (row.REGISTRATION_NUMBER ?? "").trim();
    if (!id || seen.has(id)) continue;

    const namesEn: string[] = [];
    const namesZh: string[] = [];
    const en = (row.ENGLISH_COMPANY_NAME ?? "").replace(/\s+/g, " ").trim();
    const zh = (row.CHINESE_COMPANY_NAME ?? "").replace(/\s+/g, " ").trim();
    if (en && isCorporateEntityName(en)) namesEn.push(en);
    if (zh && isCorporateEntityName(zh)) namesZh.push(zh);
    if (namesEn.length === 0 && namesZh.length === 0) continue;

    seen.add(id);
    out.push({ id, namesEn, namesZh });
  }

  return out;
}
