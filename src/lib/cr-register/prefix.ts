/** Raw-text prefix for Comp_name begins_with (not normCore/normStrict). */

const TRUNCATE_AT = /[(（&.,\-']/u;

function toHalfWidthAlnumAndParens(s: string): string {
  return s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

export function normalizePrefixSource(label: string): string {
  return toHalfWidthAlnumAndParens(label.trim()).replace(/\s+/g, " ");
}

export function truncatePrefixSource(normalized: string): string {
  const idx = normalized.search(TRUNCATE_AT);
  const cut = idx >= 0 ? normalized.slice(0, idx).trim() : normalized;
  return cut.trim();
}

function cjkCount(s: string): number {
  return [...s].filter((c) => /\p{Script=Han}/u.test(c)).length;
}

function latinCount(s: string): number {
  return [...s].filter((c) => /[A-Za-z]/.test(c)).length;
}

export function isValidPrefixSegment(segment: string): boolean {
  const s = segment.trim();
  if (!s) return false;
  return cjkCount(s) >= 2 || latinCount(s) >= 3;
}

function stripCompanySuffix(segment: string): string {
  return segment
    .replace(/(有限公司|有限|公司)$/u, "")
    .replace(/\s+(LIMITED|LTD)\.?$/i, "")
    .trim();
}

export function prefixVariantsFromSegment(segment: string): string[] {
  const normalized = normalizePrefixSource(segment);
  if (!normalized) return [];
  const truncated = truncatePrefixSource(normalized);
  const out: string[] = [];
  const candidates = [truncated];
  const stripped = stripCompanySuffix(truncated);
  if (stripped && stripped !== truncated) candidates.unshift(stripped);
  for (const c of candidates) {
    if (isValidPrefixSegment(c) && !out.includes(c)) out.push(c);
  }
  if (
    normalized !== truncated &&
    isValidPrefixSegment(normalized) &&
    !out.includes(normalized)
  ) {
    out.push(normalized);
  }
  return out;
}

function primaryPrefixFromSegment(segment: string): string | null {
  return prefixVariantsFromSegment(segment)[0] ?? null;
}

/** Split mixed label into CJK-bearing block and Latin block (M4). */
export function splitMixedLabelParts(label: string): { zh?: string; en?: string } {
  const trimmed = label.trim();
  if (!trimmed) return {};
  const hasCjk = /\p{Script=Han}/u.test(trimmed);
  const hasLatin = /[A-Za-z]/.test(trimmed);
  if (hasCjk && hasLatin) {
    let zhSeg = "";
    let enSeg = "";
    for (const token of trimmed.split(/\s+/)) {
      if (/\p{Script=Han}/u.test(token)) {
        zhSeg = zhSeg ? `${zhSeg} ${token}` : token;
      } else if (/[A-Za-z]/.test(token)) {
        enSeg = enSeg ? `${enSeg} ${token}` : token;
      }
    }
    return {
      zh: zhSeg || undefined,
      en: enSeg || undefined,
    };
  }
  if (hasCjk) return { zh: trimmed };
  if (hasLatin) return { en: trimmed };
  return {};
}

export function allNameSearchPrefixAttempts(label: string): string[] {
  const parts = splitMixedLabelParts(label);
  const ordered: string[] = [];
  if (parts.zh) {
    ordered.push(...prefixVariantsFromSegment(parts.zh));
  }
  if (parts.en) {
    ordered.push(...prefixVariantsFromSegment(parts.en));
  }
  const unique: string[] = [];
  for (const p of ordered) {
    if (!unique.includes(p)) unique.push(p);
  }
  return unique;
}

/** Up to 2 prefixes for live API attempts (zh then en). */
export function buildNameSearchPrefixes(label: string): string[] {
  const parts = splitMixedLabelParts(label);
  const ordered: string[] = [];
  if (parts.zh) {
    const p = primaryPrefixFromSegment(parts.zh);
    if (p) ordered.push(p);
  }
  if (parts.en) {
    const p = primaryPrefixFromSegment(parts.en);
    if (p) ordered.push(p);
  }
  const unique: string[] = [];
  for (const p of ordered) {
    if (!unique.includes(p)) unique.push(p);
  }
  return unique.slice(0, 2);
}
