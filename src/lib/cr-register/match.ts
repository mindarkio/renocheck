import {
  normalizeChineseCompanyName,
  normalizeEnglishCompanyName,
} from "../cause-list/normalize";
import type { CrApiLocalRow } from "./types";

export function buildNameSearchPrefixes(label: string): string[] {
  const trimmed = label.trim();
  if (!trimmed) return [];
  const hasCjk = /[\u4e00-\u9fff]/u.test(trimmed);
  const hasLatin = /[A-Za-z]/.test(trimmed);
  const prefixes: string[] = [];
  if (hasCjk) {
    const zh = normalizeChineseCompanyName(trimmed);
    const core = zh.normCore || zh.normStrict;
    if (core.length >= 2) {
      prefixes.push(core.slice(0, Math.min(8, core.length)));
    }
    const strict = zh.normStrict;
    if (strict.length >= 2 && strict !== core) {
      prefixes.push(strict.slice(0, Math.min(8, strict.length)));
    }
  }
  if (hasLatin) {
    const en = normalizeEnglishCompanyName(trimmed);
    const core = en.normCore || en.normStrict;
    if (core.length >= 2) {
      prefixes.push(core.slice(0, Math.min(12, core.length)));
    }
  }
  return [...new Set(prefixes)];
}

function rowDisplayNames(row: CrApiLocalRow): { zh: string; en: string } {
  const zh =
    row.Chinese_Company_Name &&
    row.Chinese_Company_Name !== "NULL" &&
    row.Chinese_Company_Name.trim()
      ? row.Chinese_Company_Name.trim()
      : "";
  const en = row.English_Company_Name?.trim() ?? "";
  return { zh, en };
}

function tierForRow(
  row: CrApiLocalRow,
  searchLabel: string,
): "A" | "B" | "C" | null {
  const label = searchLabel.trim();
  const { zh, en } = rowDisplayNames(row);
  const labelZh = normalizeChineseCompanyName(label);
  const labelEn = normalizeEnglishCompanyName(label);

  if (zh) {
    const rowZh = normalizeChineseCompanyName(zh);
    if (rowZh.normStrict === labelZh.normStrict) return "B";
    if (rowZh.normCore === labelZh.normCore && labelZh.normCore.length >= 4) {
      return "C";
    }
  }
  if (en) {
    const rowEn = normalizeEnglishCompanyName(en);
    if (rowEn.normStrict === labelEn.normStrict) return "B";
    if (rowEn.normCore === labelEn.normCore && labelEn.normCore.length >= 4) {
      return "C";
    }
  }
  return null;
}

export function pickMatchedRows(
  rows: CrApiLocalRow[],
  searchLabel: string,
): { tier: "A" | "B" | "C"; row: CrApiLocalRow } | "ambiguous" | null {
  const hits: { tier: "A" | "B" | "C"; row: CrApiLocalRow }[] = [];
  for (const row of rows) {
    const tier = tierForRow(row, searchLabel);
    if (tier) hits.push({ tier, row });
  }
  if (hits.length === 0) return null;
  if (hits.length > 1) {
    const brns = new Set(hits.map((h) => h.row.Brn));
    if (brns.size > 1) return "ambiguous";
  }
  return hits[0]!;
}
