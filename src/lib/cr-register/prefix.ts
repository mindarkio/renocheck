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

const HAN_RE = /\p{Script=Han}/u;
/** Latin company-suffix glued before Han, e.g. "LIMITED合成". */
const GLUED_EN_HEAD_RE =
  /^([A-Za-z0-9&.,'()-]*(?<![A-Za-z])(?:LIMITED|LTD\.?|CO\.?))(?=\p{Script=Han})/iu;
/** Linear split of "…有限公司ABC" into zh "…有限公司" + en "ABC" (no regex backtracking). */
function splitGluedLatinTail(tok: string): { zh: string; en: string } | null {
  const chars = [...tok];
  let last = -1;
  for (let k = chars.length - 1; k >= 0; k--) {
    if (HAN_RE.test(chars[k]!)) {
      last = k;
      break;
    }
  }
  if (last < 0) return null;
  let cut = last + 1;
  while (cut < chars.length && (chars[cut] === ")" || chars[cut] === "]")) cut++;
  const zh = chars.slice(0, cut).join("");
  const tail = chars.slice(cut).join("");
  if (!/[A-Za-z]/.test(tail)) return null;
  if (!/(有限公司|公司|有限)[)\]]*$/u.test(zh)) return null;
  return { zh, en: tail.replace(/^[^A-Za-z0-9]+/, "") };
}

/** Split mixed label into CJK-bearing block and Latin block (M4). */
export function splitMixedLabelParts(label: string): { zh?: string; en?: string } {
  const normalized = normalizePrefixSource(label);
  if (!normalized) return {};
  const hasCjk = /\p{Script=Han}/u.test(normalized);
  const hasLatin = /[A-Za-z]/.test(normalized);
  if (!hasCjk && !hasLatin) return {};

  if (hasCjk && hasLatin) {
    const tokens = normalized.split(" ").filter(Boolean);
    const zhParts: string[] = [];
    const enParts: string[] = [];
    const isLatinTok = (t?: string) =>
      t !== undefined && !HAN_RE.test(t) && /[A-Za-z]/.test(t);
    tokens.forEach((tok, i) => {
      if (!HAN_RE.test(tok)) {
        if (/[A-Za-z]/.test(tok)) enParts.push(tok);
        return;
      }
      let zhTok = tok;
      const head = zhTok.match(GLUED_EN_HEAD_RE);
      if (head && isLatinTok(tokens[i - 1])) {
        enParts.push(head[1]!);
        zhTok = zhTok.slice(head[1]!.length);
      }
      if (
        isLatinTok(tokens[i + 1]) ||
        /(?:有限公司|公司)[)\]]*\/[A-Za-z]/u.test(zhTok)
      ) {
        const split = splitGluedLatinTail(zhTok);
        if (split) {
          zhTok = split.zh;
          if (split.en) enParts.push(split.en);
        }
      }
      zhParts.push(zhTok);
    });
    return {
      zh: zhParts.join(" ") || undefined,
      en: enParts.join(" ") || undefined,
    };
  }
  if (hasCjk) return { zh: normalized };
  if (hasLatin) return { en: normalized };
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
