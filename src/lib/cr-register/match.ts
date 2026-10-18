import {
  normalizeChineseCompanyName,
  normalizeEnglishCompanyName,
} from "../cause-list/normalize";
import { splitMixedLabelParts } from "./prefix";
import { crStringField } from "./row-fields";
import type { CrApiLocalRow } from "./types";

export {
  allNameSearchPrefixAttempts,
  buildNameSearchPrefixes,
} from "./prefix";

const TIER_RANK: Record<"A" | "B" | "C", number> = { A: 0, B: 1, C: 2 };

function rowDisplayNames(row: CrApiLocalRow): { zh: string; en: string } {
  const zhRaw = crStringField(row.Chinese_Company_Name);
  const zh = zhRaw && zhRaw !== "NULL" ? zhRaw : "";
  const en = crStringField(row.English_Company_Name);
  return { zh, en };
}

export function tierForRow(
  row: CrApiLocalRow,
  searchLabel: string,
): "A" | "B" | "C" | null {
  const label = searchLabel.trim();
  const parts = splitMixedLabelParts(label);
  const labelHasLatin = /[A-Za-z]/.test(label);
  const { zh, en } = rowDisplayNames(row);

  if (zh && (parts.zh !== undefined || !labelHasLatin)) {
    const labelZh = normalizeChineseCompanyName(parts.zh ?? label);
    const rowZh = normalizeChineseCompanyName(zh);
    if (rowZh.normStrict === labelZh.normStrict) return "B";
    if (rowZh.normCore === labelZh.normCore && labelZh.normCore.length >= 4) {
      return "C";
    }
  }
  if (en && parts.en !== undefined) {
    const labelEn = normalizeEnglishCompanyName(parts.en);
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
  if (rows.length >= 100) {
    const hasB = rows.some((r) => tierForRow(r, searchLabel) === "B");
    if (!hasB) return null;
  }

  const hits: { tier: "A" | "B" | "C"; row: CrApiLocalRow }[] = [];
  for (const row of rows) {
    const tier = tierForRow(row, searchLabel);
    if (tier) hits.push({ tier, row });
  }
  if (hits.length === 0) return null;

  const bestRank = Math.min(...hits.map((h) => TIER_RANK[h.tier]));
  const bestTier = (["A", "B", "C"] as const).find(
    (t) => TIER_RANK[t] === bestRank,
  )!;
  const atBest = hits.filter((h) => h.tier === bestTier);
  const brns = new Set(atBest.map((h) => h.row.Brn));
  if (brns.size > 1) return "ambiguous";
  return atBest[0]!;
}
