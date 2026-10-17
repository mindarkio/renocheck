/** Split MWC registry `company_name` into Chinese / English forms (deterministic). */

const CJK_RE = /[\u4e00-\u9fff]/u;
const LATIN_RE = /[A-Za-z]/;

export type MwcBilingualNames = {
  combined: string;
  zh: string | null;
  en: string | null;
};

export function extractMwcBilingualNames(companyName: string): MwcBilingualNames {
  const combined = companyName.replace(/\s+/g, " ").trim();
  if (!combined) {
    return { combined: "", zh: null, en: null };
  }

  const paren = combined.match(/^(.+?)\s*[（(]([^)）]+)[)）]\s*$/u);
  if (paren) {
    const left = paren[1].trim();
    const right = paren[2].trim();
    const leftLatin = LATIN_RE.test(left) && !CJK_RE.test(left);
    const rightLatin = LATIN_RE.test(right) && !CJK_RE.test(right);
    if (leftLatin && !rightLatin) {
      return { combined, zh: right, en: left };
    }
    if (!leftLatin && rightLatin) {
      return { combined, zh: left, en: right };
    }
  }

  if (CJK_RE.test(combined)) {
    return { combined, zh: combined, en: null };
  }
  if (LATIN_RE.test(combined)) {
    return { combined, zh: null, en: combined };
  }
  return { combined, zh: combined, en: null };
}

export function mwcBilingualLookupTerms(names: MwcBilingualNames): string[] {
  const out = new Set<string>();
  for (const t of [names.combined, names.zh, names.en]) {
    if (t && t.trim().length >= 2) out.add(t.trim());
  }
  return [...out];
}
