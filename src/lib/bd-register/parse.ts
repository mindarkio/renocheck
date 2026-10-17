import { parse } from "csv-parse/sync";
import {
  normalizeChineseCompanyName,
  normalizeEnglishCompanyName,
} from "../cause-list/normalize";
import { parseBdRegistryExpiryDate } from "../mwc-registry-display";
import {
  isBdContractorRegisterType,
  isBdIndividualContractorType,
} from "./sources";
import type { BdRegisterEntry } from "./types";

export type BdCsvRow = Record<string, string>;

const IN_LIQUIDATION_RE = /\s*\(IN\s+LIQUIDATION\)\s*$/i;

function stripHtml(s: string): string {
  return s.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

function stripLiquidationSuffix(name: string): string {
  return name.replace(IN_LIQUIDATION_RE, "").trim();
}

function pickCompanyDisplayNames(row: BdCsvRow): { en?: string; zh?: string } {
  const en = stripLiquidationSuffix(stripHtml(row.ENGLISH_COMPANY_NAME ?? ""));
  const zh = stripLiquidationSuffix(stripHtml(row.CHINESE_COMPANY_NAME ?? ""));
  return {
    en: en || undefined,
    zh: zh || undefined,
  };
}

function hasCompanyName(row: BdCsvRow): boolean {
  const { en, zh } = pickCompanyDisplayNames(row);
  return Boolean(en || zh);
}

function normalizeCompanyOutput(en?: string, zh?: string): { nameEn?: string; nameZh?: string } {
  const out: { nameEn?: string; nameZh?: string } = {};
  if (en) out.nameEn = normalizeEnglishCompanyName(en).normStrict;
  if (zh) out.nameZh = normalizeChineseCompanyName(zh).normStrict;
  return out;
}

function pickStatus(row: BdCsvRow): string | undefined {
  const flag = stripHtml(row.FLAG ?? "");
  return flag || undefined;
}

/**
 * Parse BD registers full-list CSV into contractor rows.
 * Individual contractors (MWC(W)): regNo only — no personal names in output.
 */
export function parseBdRegisterCsv(csvText: string): BdRegisterEntry[] {
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as BdCsvRow[];

  const out: BdRegisterEntry[] = [];

  for (const row of rows) {
    const registerType = (row.REGISTRATION_TYPE ?? "").trim();
    if (!isBdContractorRegisterType(registerType)) continue;

    const regNo = (row.REGISTRATION_NUMBER ?? "").trim();
    if (!regNo) continue;

    const expiryDate = parseBdRegistryExpiryDate(row.EXPIRY_DATE ?? "") ?? undefined;
    const status = pickStatus(row);

    if (isBdIndividualContractorType(registerType) || !hasCompanyName(row)) {
      out.push({ registerType, regNo, expiryDate, status });
      continue;
    }

    const { en, zh } = pickCompanyDisplayNames(row);
    const names = normalizeCompanyOutput(en, zh);
    out.push({
      registerType,
      regNo,
      ...names,
      expiryDate,
      status,
    });
  }

  return out;
}

/** MWC company registration numbers for overlap checks (excludes MWC(W)). */
export function mwcCompanyRegNos(entries: BdRegisterEntry[]): Set<string> {
  const set = new Set<string>();
  for (const e of entries) {
    if (e.registerType === "MWC" && (e.nameEn || e.nameZh)) set.add(e.regNo);
  }
  return set;
}

export function filterRegisterType(
  entries: BdRegisterEntry[],
  registerType: string,
): BdRegisterEntry[] {
  return entries.filter((e) => e.registerType === registerType);
}
