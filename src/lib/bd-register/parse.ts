import { parse } from "csv-parse/sync";
import { isCorporateEntityName } from "../cause-list/party";
import {
  normalizeChineseCompanyName,
  normalizeEnglishCompanyName,
} from "../cause-list/normalize";
import { parseBdRegistryExpiryDate } from "../mwc-registry-display";
import {
  isBdContractorRegisterType,
  isBdIndividualContractorType,
} from "./sources";
import type { BdParseResult, BdRegisterEntry } from "./types";

export type BdCsvRow = Record<string, string>;

const REQUIRED_HEADERS = [
  "REGISTRATION_NUMBER",
  "REGISTRATION_TYPE",
  "ENGLISH_COMPANY_NAME",
  "CHINESE_COMPANY_NAME",
  "EXPIRY_DATE",
  "FLAG",
] as const;

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

function pickFlag(row: BdCsvRow): string | undefined {
  const flag = stripHtml(row.FLAG ?? "").trim();
  if (!flag || flag === "@") return undefined;
  return flag;
}

export function assertBdRegisterCsvText(csvText: string): void {
  if (csvText.includes("\u0000") || /^\s*</.test(csvText)) {
    throw new Error("BD CSV: not a UTF-8 CSV (UTF-16 or HTML/XML error page)");
  }
}

export function parseBdRegisterCsvRows(csvText: string): BdCsvRow[] {
  assertBdRegisterCsvText(csvText);
  try {
    return parse(csvText, {
      bom: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: false,
      columns: (headers: string[]) => {
        const trimmed = headers.map((h) => h.trim());
        const missing = REQUIRED_HEADERS.filter((r) => !trimmed.includes(r));
        if (missing.length) {
          throw new Error(`BD CSV header missing: ${missing.join(",")}`);
        }
        return trimmed;
      },
    }) as BdCsvRow[];
  } catch (e) {
    const err = e as { code?: string; lines?: number; message: string };
    const prefix = `BD CSV parse error ${err.code ?? ""} at line ${err.lines ?? "?"}`;
    if (err.message.startsWith("BD CSV")) {
      throw new Error(`${prefix}: ${err.message}`);
    }
    throw new Error(prefix);
  }
}

function dedupeEntries(entries: BdRegisterEntry[]): BdRegisterEntry[] {
  const seen = new Map<string, BdRegisterEntry>();
  for (const e of entries) {
    const key = `${e.registerType}|${e.regNo}`;
    if (!seen.has(key)) seen.set(key, e);
  }
  return [...seen.values()];
}

/**
 * Parse BD registers full-list CSV into contractor rows (de-duplicated by type|regNo).
 * Individual contractors (MWC(W)): regNo only — no personal names in output.
 */
export function parseBdRegisterCsv(csvText: string): BdRegisterEntry[] {
  return parseBdRegisterCsvWithMeta(csvText).entries;
}

export function parseBdRegisterCsvWithMeta(csvText: string): BdParseResult {
  const rows = parseBdRegisterCsvRows(csvText);
  const staged: BdRegisterEntry[] = [];

  for (const row of rows) {
    const registerType = (row.REGISTRATION_TYPE ?? "").trim();
    if (!isBdContractorRegisterType(registerType)) continue;

    const regNo = (row.REGISTRATION_NUMBER ?? "").trim();
    if (!regNo) continue;

    const expiryDate = parseBdRegistryExpiryDate(row.EXPIRY_DATE ?? "") ?? undefined;
    const flag = pickFlag(row);

    if (isBdIndividualContractorType(registerType)) {
      staged.push({ registerType, regNo, expiryDate, flag });
      continue;
    }

    const { en, zh } = pickCompanyDisplayNames(row);
    const corporate = Boolean(
      (en && isCorporateEntityName(en)) || (zh && isCorporateEntityName(zh)),
    );
    if (!corporate) {
      staged.push({
        registerType,
        regNo,
        expiryDate,
        flag,
        unincorporated: true,
      });
      continue;
    }

    const normEn = en ? normalizeEnglishCompanyName(en) : undefined;
    const normZh = zh ? normalizeChineseCompanyName(zh) : undefined;
    staged.push({
      registerType,
      regNo,
      nameEn: en,
      nameZh: zh,
      normStrictEn: normEn?.normStrict,
      normStrictZh: normZh?.normStrict,
      normCoreEn: normEn?.normCore,
      normCoreZh: normZh?.normCore,
      expiryDate,
      flag,
    });
  }

  const rawContractorRows = staged.length;
  return { entries: dedupeEntries(staged), rawContractorRows };
}

/** MWC company registration numbers for overlap checks (excludes MWC(W) and unincorporated). */
export function mwcCompanyRegNos(entries: BdRegisterEntry[]): Set<string> {
  const set = new Set<string>();
  for (const e of entries) {
    if (e.registerType === "MWC" && !e.unincorporated && (e.nameEn || e.nameZh)) {
      set.add(e.regNo);
    }
  }
  return set;
}

export function filterRegisterType(
  entries: BdRegisterEntry[],
  registerType: string,
): BdRegisterEntry[] {
  return entries.filter((e) => e.registerType === registerType);
}
