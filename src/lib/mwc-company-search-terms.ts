const VARIANT_PAIRS: readonly (readonly [string, string])[] = [
  ["恒", "恆"],
  ["峯", "峰"],
  ["綫", "線"],
  ["裏", "裡"],
  ["着", "著"],
];

const TRAILING_FILLERS = ["判詞", "評價", "投訴", "好唔好", "裝修"] as const;

/** A stripped remainder shorter than this is too generic for `%term%` (e.g. 2-char 合成). */
const MIN_FILLER_REMAINDER = 4;

/** Upper bound on ilike terms per search (each term is up to 2 sequential queries). */
export const MAX_MWC_LOOKUP_TERMS = 16;

function decodeHtmlEntities(label: string): string {
  return label
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

/** Spaces (including ideographic space) sitting between two Han characters. */
export function collapseSpacesBetweenCjk(value: string): string {
  return value.replace(
    /(?<=\p{Script=Han})[ \t\u3000]+(?=\p{Script=Han})/gu,
    "",
  );
}

/** Drop trailing search filler. The caller's original string stays in the term list. */
export function stripTrailingSearchFillers(value: string): string {
  let current = value.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const filler of TRAILING_FILLERS) {
      const re = new RegExp(`\\s*${filler}$`, "u");
      if (!re.test(current)) continue;
      const next = current.replace(re, "").trim();
      if ([...next].length < MIN_FILLER_REMAINDER || next === current) continue;
      current = next;
      changed = true;
    }
  }
  return current;
}

function variantCharForms(value: string): string[] {
  const present = VARIANT_PAIRS.filter(
    ([a, b]) => value.includes(a) || value.includes(b),
  );
  if (present.length === 0) return [value];
  const out: string[] = [];
  const seen = new Set<string>();
  const combos = 1 << present.length;
  for (let mask = 0; mask < combos; mask++) {
    let next = value;
    for (let i = 0; i < present.length; i++) {
      const pair = present[i];
      if (!pair) continue;
      const [a, b] = pair;
      const useSecond = (mask & (1 << i)) !== 0;
      next = useSecond ? next.replaceAll(a, b) : next.replaceAll(b, a);
    }
    if (!seen.has(next)) {
      seen.add(next);
      out.push(next);
    }
  }
  return out;
}

const FULLWIDTH_DIGIT_OFFSET = 0xfee0;

/** ASCII digits → ０–９. Register names keep this width; ILIKE does not NFKC. */
function toFullwidthDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) + FULLWIDTH_DIGIT_OFFSET),
  );
}

/**
 * Drop spaces that sit between two digits, or between a digit and a Han
 * character (`創建 2 1` / `創建２ １工程`). A Latin word space (`21 LTD`) stays.
 */
function collapseOddDigitSpaces(value: string): string {
  const joinedDigits = value.replace(/([0-9])[ \t\u3000]+(?=[0-9])/gu, "$1");
  return joinedDigits
    .replace(/(\p{Script=Han})[ \t\u3000]+(?=[0-9])/gu, "$1")
    .replace(/([0-9])[ \t\u3000]+(?=\p{Script=Han})/gu, "$1");
}

/**
 * NFKC (fullwidth digits and Latin → ASCII), then register-width digits and
 * the same strings with odd digit spaces removed. Fullwidth forms are pushed
 * before the compacted halfwidth form. The caller's original string is still
 * the first lookup term.
 */
function nfkcDigitForms(value: string): string[] {
  const nfkc = value.normalize("NFKC");
  const compact = collapseOddDigitSpaces(nfkc);
  return [nfkc, toFullwidthDigits(nfkc), toFullwidthDigits(compact), compact];
}

function spacedCompanyForms(value: string): string[] {
  const joinedLimited = value.replace(/有限[ \t\u3000]+公司/gu, "有限公司");
  const collapsed = collapseSpacesBetweenCjk(joinedLimited);
  const forms = [value];
  if (joinedLimited !== value) forms.push(joinedLimited);
  if (collapsed !== value && collapsed !== joinedLimited) forms.push(collapsed);
  const withFillers = [...forms];
  for (const form of forms) {
    const stripped = stripTrailingSearchFillers(form);
    if (stripped !== form) withFillers.push(stripped);
  }
  return withFillers;
}

/**
 * Escape PostgreSQL ILIKE wildcards. Default LIKE escape is backslash,
 * so `_` and `%` in a company name match literally. PostgREST also turns
 * `*` into `%` in like/ilike values, so `*` becomes the one-char `_`.
 */
export function escapeIlikePattern(term: string): string {
  return term
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/\*/g, "_");
}

/**
 * Variants for mwc_contractors company-name ilike.
 * Contains / character-variant normalize only — no fuzzy auto-pick.
 * NFKC plus fullwidth and spaced-digit forms cover register `２１` vs typed `21`.
 */
export function mwcCompanyNameLookupTerms(companyName: string): string[] {
  const raw = decodeHtmlEntities(companyName.trim());
  if (!raw) return [];

  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if ([...t].length >= 2) seen.add(t);
  };

  const expandLtd = (s: string) => {
    add(s);
    add(s.replace(/\bLTD\.?\b/gi, "LIMITED"));
    add(s.replace(/\bLIMITED\b/gi, "LTD"));
    add(s.replace(/\bCO\.?\b/gi, "COMPANY"));
    add(s.replace(/\bCOMPANY\b/gi, "CO"));
  };

  const seeds: string[] = [];
  const pushSeed = (s: string) => {
    const t = s.trim();
    if (t && !seeds.includes(t)) seeds.push(t);
  };

  pushSeed(raw);
  pushSeed(raw.replace(/（/g, "(").replace(/）/g, ")"));
  pushSeed(raw.replace(/[（）()]/gu, "").replace(/\s+/g, " "));
  const stripped = raw
    .replace(/有限公司$/u, "")
    .replace(/有限責任公司$/u, "")
    .trim();
  pushSeed(stripped);
  pushSeed(stripped.replace(/[（）()]/gu, "").replace(/\s+/g, " "));
  for (const seed of [...seeds]) {
    for (const form of nfkcDigitForms(seed)) pushSeed(form);
  }

  const normalized: string[] = [];
  for (const seed of seeds) {
    for (const form of spacedCompanyForms(seed)) {
      if (!normalized.includes(form)) normalized.push(form);
    }
  }

  for (const form of normalized) expandLtd(form);
  for (const form of normalized) {
    for (const variant of variantCharForms(form)) {
      if (variant !== form) expandLtd(variant);
    }
  }

  return [...seen].slice(0, MAX_MWC_LOOKUP_TERMS);
}
