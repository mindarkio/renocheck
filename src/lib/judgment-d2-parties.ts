/** D2 — parse LRS `partiesLine` (deterministic, no LLM). */

export type SplitParties = {
  left: string;
  right: string;
};

const PARTY_SPLIT_RE =
  /\s+(?:對|诉|訴)\s+|\s+v\.?\s+|\s+vs\.?\s+|\s+v,\s+/iu;

function normalizePartiesLineRaw(partiesLine: string): string {
  return partiesLine
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[／]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitPartiesLine(partiesLine: string): SplitParties | null {
  const line = normalizePartiesLineRaw(partiesLine);
  if (!line) return null;
  const parts = line.split(PARTY_SPLIT_RE);
  if (parts.length !== 2) return null;
  const left = parts[0].trim();
  const right = parts[1].trim();
  if (!left || !right) return null;
  return { left, right };
}

/** One retry with normalisation / bracket strip before `review`. */
export function splitPartiesLineWithRetry(partiesLine: string): {
  split: SplitParties | null;
  retried: boolean;
} {
  const first = splitPartiesLine(partiesLine);
  if (first) return { split: first, retried: false };

  const stripped = normalizePartiesLineRaw(partiesLine)
    .replace(/（[^）]*）/gu, "")
    .replace(/\([^)]*\)/g, "");
  const second = splitPartiesLine(stripped);
  if (second) return { split: second, retried: true };

  const vsNorm = stripped.replace(/\s+v\s*\.?\s+/gi, " v ");
  const third = splitPartiesLine(vsNorm);
  if (third) return { split: third, retried: true };

  const lastAgainst = stripped.match(/^(.+?)\s+對\s+(.+)$/u);
  if (lastAgainst) {
    const left = lastAgainst[1].trim();
    const right = lastAgainst[2].trim();
    if (left && right && !left.includes(" 對 ")) {
      return { split: { left, right }, retried: true };
    }
  }

  return { split: null, retried: true };
}

/** Default civil listing: 原告／申索人 left，被告／答辯人 right. */
export function defaultDefendantPartyLabel(split: SplitParties): string {
  return split.right;
}

export function defaultPlaintiffPartyLabel(split: SplitParties): string {
  return split.left;
}

const RENOVATION_HINT_RE =
  /裝修|工程|承建|翻新|滲水|室內|水電|裝飾|裝璜|contractor|decoration|engineering|renovation/i;

export function partiesSuggestRenovationRelevant(
  partiesLine: string,
  profileId?: string,
): boolean {
  if (RENOVATION_HINT_RE.test(partiesLine)) return true;
  if (profileId && RENOVATION_HINT_RE.test(profileId)) return true;
  const pid = profileId ?? "";
  if (
    pid.includes("裝修") ||
    pid.includes("工程") ||
    pid.includes("滲水") ||
    pid.includes("翻新") ||
    pid.includes("承辦")
  ) {
    return true;
  }
  return false;
}

export function caseRefPrefix(caseRef: string): string {
  const m = caseRef.trim().match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : "";
}
