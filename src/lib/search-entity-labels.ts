import { resolveAuthoritativeSearchLabel } from "./entity-report-context";

function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")");
}

/** Case-folded label for alias equality (Latin hits and register English names). */
export function foldSearchAlias(value: string): string {
  return normalizeForMatch(value).toLowerCase();
}

function stripCompanySuffix(label: string): string {
  return label
    .replace(/有限公司$/u, "")
    .replace(/有限責任公司$/u, "")
    .trim();
}

/**
 * Typed fragments shorter than this are not distinctive enough to search or
 * bind. CJK floor matches the filler-remainder / public-link anchor floor.
 * Latin fragments need a longer floor so a 4-letter stem is not an anchor.
 */
const MIN_CJK_ALIAS_CHARS = 4;
const MIN_LATIN_ALIAS_CHARS = 6;

/** Trade words that match a large slice of the register when used alone. */
const GENERIC_ALIAS_ATOMS = [
  "室內設計",
  "有限公司",
  "有限責任",
  "裝修工程",
  "設計工程",
  "工程公司",
  "裝修公司",
  "設計公司",
  "顧問公司",
  "裝飾工程",
  "裝飾公司",
  "contractors",
  "contractor",
  "construction",
  "engineering",
  "decoration",
  "interiors",
  "interior",
  "limited",
  "company",
  "設計",
  "裝修",
  "工程",
  "公司",
  "顧問",
  "裝飾",
  "室內",
  "有限",
  "責任",
  "香港",
  "國際",
  "design",
  "hong",
  "kong",
  "ltd",
  "co",
  "hk",
  // Trade / filler words that also appear in thousands of unrelated pages.
  "一站式",
  "建築",
  "建設",
  "機電",
  "水電",
  "冷氣",
  "空調",
  "家居",
  "全屋",
  "翻新",
  "維修",
  "傢俬",
  "屋宇",
  "集團",
  "企業",
  "發展",
  "實業",
  "貿易",
  "環球",
  "亞洲",
  "中國",
  "及",
  // Simplified forms (NFKC does not fold Simplified to Traditional).
  "装修",
  "设计",
  "装饰",
  "室内",
  "顾问",
  "国际",
  "建筑",
  "机电",
  "水电",
  "冷气",
  "空调",
  "维修",
  "集团",
  "发展",
  "实业",
  "贸易",
  "环球",
  "亚洲",
  "中国",
  "责任",
  "renovations",
  "renovation",
  "international",
  "development",
  "solutions",
  "holdings",
  "services",
  "service",
  "builders",
  "building",
  "trading",
  "living",
  "group",
  "homes",
  "works",
  "decor",
  "home",
  "asia",
  "and",
  "the",
] as const;

const GENERIC_ALIAS_ATOMS_BY_LENGTH = [...GENERIC_ALIAS_ATOMS].sort(
  (a, b) => b.length - a.length,
);

function isLatinFragment(value: string): boolean {
  return /[a-z]/i.test(value);
}

/** English legal names are not chopped to a 6-character prefix. */
function isUntruncatedLatinName(label: string): boolean {
  let latin = 0;
  let han = 0;
  for (const ch of label) {
    if (/\p{Script=Han}/u.test(ch)) han += 1;
    else if (/[A-Za-z]/u.test(ch)) latin += 1;
  }
  return latin >= 4 && han === 0;
}

const LATIN_TRADE_ATOMS = new Set(
  GENERIC_ALIAS_ATOMS.filter((atom) => /[a-z]/i.test(atom)).map((atom) =>
    atom.toLowerCase(),
  ),
);

const CJK_TRADE_ATOMS = GENERIC_ALIAS_ATOMS.filter((atom) =>
  /\p{Script=Han}/u.test(atom),
);

/**
 * True when the string contains a company or trade marker from the generic
 * alias list. Latin markers match whole words so "craft" is not "co".
 * Han markers match inside the string so 陳生裝修 still contains 裝修.
 */
export function hasSearchTradeMarker(raw: string): boolean {
  const nfkc = raw.normalize("NFKC").toLowerCase();
  const compact = nfkc.replace(/[\s\u3000]+/g, "");
  if (CJK_TRADE_ATOMS.some((atom) => compact.includes(atom))) return true;
  const words = nfkc.split(/[^a-z]+/).filter(Boolean);
  return words.some((word) => LATIN_TRADE_ATOMS.has(word));
}

/** True when `compact` splits fully into generic atoms (any split, not only greedy). */
function isOnlyGenericWords(compact: string): boolean {
  const ok: boolean[] = new Array(compact.length + 1).fill(false);
  ok[0] = true;
  for (let i = 0; i < compact.length; i += 1) {
    if (!ok[i]) continue;
    for (const atom of GENERIC_ALIAS_ATOMS_BY_LENGTH) {
      if (compact.startsWith(atom, i)) ok[i + atom.length] = true;
    }
  }
  return ok[compact.length] === true;
}

/**
 * User-typed fragment that would bind too many companies: very short, or only
 * trade words such as 裝修 / 設計 / 工程 (alone or concatenated).
 */
export function isGenericSearchAlias(raw: string): boolean {
  const folded = foldSearchAlias(raw);
  if (!folded) return true;
  const min = isLatinFragment(folded) ? MIN_LATIN_ALIAS_CHARS : MIN_CJK_ALIAS_CHARS;
  if ([...folded].length < min) return true;
  const compact = folded.replace(/[.+&/()]/g, "");
  if (!compact) return true;
  return isOnlyGenericWords(compact);
}

export type ExtraSearchPhraseOpts = {
  mwcCompanyName?: string;
  mwcCompanyNameEn?: string;
  /**
   * Two or more register rows contain the typed text. The typed fragment is
   * then shared by several firms, so it must not become a search phrase or an
   * L1 anchor for the one row we picked.
   */
  mwcAmbiguous?: boolean;
};

/** English legal suffix (Limited / Ltd / Company Limited / Co Ltd). */
function stripLatinCompanySuffix(label: string): string {
  return label
    .replace(/[\s,.]*\b(?:company\s+limited|co\.?,?\s*ltd\.?|limited|ltd\.?)\s*$/iu, "")
    .trim();
}

function hasHan(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

function pushPhrase(out: string[], seen: Set<string>, phrase: string): void {
  const trimmed = phrase.trim();
  const key = foldSearchAlias(trimmed);
  if (!key || seen.has(key)) return;
  seen.add(key);
  out.push(trimmed);
}

/**
 * Extra Serp/L1 phrases after an MWC hit: the typed brand when it is a
 * distinctive substring of the matched legal name, plus the register English
 * name. Phrases already covered by the legal name or its 有限公司-stripped
 * form are omitted (Q1/Q2 already search those).
 */
export function extraSearchPhrases(
  input: { companyName?: string },
  opts?: ExtraSearchPhraseOpts,
): string[] {
  const legal = [opts?.mwcCompanyName, opts?.mwcCompanyNameEn]
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name));
  const out: string[] = [];
  const seen = new Set<string>();

  const typed = input.companyName?.trim();
  if (
    typed &&
    legal.length > 0 &&
    !opts?.mwcAmbiguous &&
    !isGenericSearchAlias(typed) &&
    !isGenericSearchAlias(stripCompanySuffix(typed))
  ) {
    const alias = foldSearchAlias(typed);
    // A Latin-only fragment (「Dimensions」「Modern」) is an ordinary English
    // word far more often than a brand. Only the whole English name without
    // its legal suffix is distinctive enough.
    const latinOnly = !hasHan(typed);
    const englishBrand = opts?.mwcCompanyNameEn?.trim();
    const insideLegal = latinOnly
      ? Boolean(englishBrand) &&
        alias === foldSearchAlias(stripLatinCompanySuffix(englishBrand!))
      : legal.some((name) => foldSearchAlias(name).includes(alias));
    const alreadySearched = legal.some((name) => {
      const stripped = stripCompanySuffix(name);
      return alias === foldSearchAlias(name) || alias === foldSearchAlias(stripped);
    });
    if (insideLegal && !alreadySearched) pushPhrase(out, seen, typed);
  }

  const english = opts?.mwcCompanyNameEn?.trim();
  if (english && !isGenericRegisterEnglishName(english)) {
    const key = foldSearchAlias(english);
    const zh = opts?.mwcCompanyName?.trim();
    const sameAsZh =
      zh !== undefined &&
      (key === foldSearchAlias(zh) || key === foldSearchAlias(stripCompanySuffix(zh)));
    if (!sameAsZh) pushPhrase(out, seen, english);
  }
  return out;
}

/** Official English names made only of trade words are not safe anchors. */
function isGenericRegisterEnglishName(raw: string): boolean {
  const folded = foldSearchAlias(raw);
  if ([...folded].length < MIN_CJK_ALIAS_CHARS) return true;
  const compact = folded.replace(/[.+&/()]/g, "");
  if (!compact) return true;
  return isOnlyGenericWords(compact);
}

/** Substrings used for L1 hit binding (title + snippet + url). */
export function entityMatchTokens(
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: ExtraSearchPhraseOpts & { phoneNormalized?: string },
): string[] {
  const primary = resolveAuthoritativeSearchLabel(input, opts);
  const tokens = new Set<string>();

  if (primary) {
    tokens.add(primary);
    const stripped = stripCompanySuffix(primary);
    if (stripped.length >= 2) tokens.add(stripped);
    if (stripped.length >= 4 && !isUntruncatedLatinName(stripped)) {
      tokens.add(stripped.slice(0, Math.min(6, stripped.length)));
    }
  }

  if (opts?.mwcCompanyName?.trim()) {
    const mwc = opts.mwcCompanyName.trim();
    tokens.add(mwc);
    const mwcStripped = stripCompanySuffix(mwc);
    if (mwcStripped.length >= 2) tokens.add(mwcStripped);
  }

  for (const phrase of extraSearchPhrases(input, opts)) {
    if ([...phrase].length >= 2) tokens.add(phrase);
  }

  const phone = opts?.phoneNormalized?.trim();
  if (phone && phone.length >= 8) {
    tokens.add(phone);
  }

  // Eval-validated heuristics only (DEC-0002); not a configurable blacklist.
  const blob = normalizeForMatch(
    `${primary} ${opts?.mwcCompanyName ?? ""}`,
  );
  if (blob.includes("良心裝修")) {
    tokens.add("良心裝修佬");
    tokens.add("良心裝修");
  }

  if (blob.includes("創建21顧問") || blob.includes("創建21")) {
    tokens.add("創建21顧問有限公司");
    tokens.add("CR21康藝家居");
  }

  if (blob.includes("源始")) {
    tokens.add("源始（國際）");
    tokens.add("源始(國際)");
    tokens.add("源始國際");
    tokens.add("源始（國際）設計及裝修");
    tokens.add("源始(國際)設計及裝修");
    tokens.add("源始（國際）設計及裝修公司");
    tokens.add("源始(國際)設計及裝修公司");
    // Never bare「源始」— matches 物種源始、源始火花、字典等 (DEC-0002 heuristic).
  }

  return [...tokens].filter((t) => t.length >= 2);
}

/** Extra L1 gate for ambiguous brand tokens (must match at least one). */
export function entityL1MustIncludeAny(
  searchLabelUsed: string,
): string[] | undefined {
  if (!searchLabelUsed.includes("源始")) return undefined;
  return [
    "源始（國際）",
    "源始(國際)",
    "源始國際",
    "源始（國際）設計及裝修公司",
    "源始(國際)設計及裝修公司",
    "設計及裝修公司",
    "設計及裝修有限公司",
  ];
}

/** NFKC + trim for Serp/L1 (MWC fullwidth digits ↔ forum halfwidth). */
export function normalizeSearchLabelForSerp(searchLabelUsed: string): string {
  return searchLabelUsed.normalize("NFKC").trim();
}

/** Forum/news copy often omits「有限公司」— use shorter Serp phrase (DEC-0003). */
export function resolveBrandSerpSearchPhrase(
  searchLabelUsed: string,
): string | undefined {
  const e = normalizeSearchLabelForSerp(searchLabelUsed);
  if (e.includes("源始")) {
    return "源始（國際）設計及裝修公司";
  }
  if (e.includes("創建21") && e.includes("顧問")) {
    return "創建21顧問有限公司";
  }
  return undefined;
}
