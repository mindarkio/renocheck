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

export type CrMatchedPick = {
  tier: "A" | "B" | "C";
  row: CrApiLocalRow;
};

/**
 * Grade D is not a match. The prefix search returned only 1–2 rows and
 * none of them are B/C. Callers must keep `matched` false and must not
 * change report grading.
 */
export type CrCandidatePick = {
  tier: "D";
  rows: CrApiLocalRow[];
};

export type CrPickResult = CrMatchedPick | CrCandidatePick | "ambiguous" | null;

export function isCrMatchedPick(pick: CrPickResult): pick is CrMatchedPick {
  return pick !== null && pick !== "ambiguous" && pick.tier !== "D";
}

export function pickMatchedRows(
  rows: CrApiLocalRow[],
  searchLabel: string,
): CrPickResult {
  if (rows.length >= 100) {
    const hasB = rows.some((r) => tierForRow(r, searchLabel) === "B");
    if (!hasB) return null;
  }

  const hits: CrMatchedPick[] = [];
  for (const row of rows) {
    const tier = tierForRow(row, searchLabel);
    if (tier) hits.push({ tier, row });
  }
  if (hits.length === 0) {
    if (rows.length >= 1 && rows.length <= 2) {
      return { tier: "D", rows: rows.slice(0, 2) };
    }
    return null;
  }

  const bestRank = Math.min(...hits.map((h) => TIER_RANK[h.tier]));
  const bestTier = (["A", "B", "C"] as const).find(
    (t) => TIER_RANK[t] === bestRank,
  )!;
  const atBest = hits.filter((h) => h.tier === bestTier);
  const brns = new Set(atBest.map((h) => h.row.Brn));
  if (brns.size > 1) return "ambiguous";
  return atBest[0]!;
}
