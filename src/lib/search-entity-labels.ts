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

function isOnlyGenericWords(compact: string): boolean {
  let rest = compact;
  while (rest.length > 0) {
    const atom = GENERIC_ALIAS_ATOMS_BY_LENGTH.find((candidate) =>
      rest.startsWith(candidate),
    );
    if (!atom) return false;
    rest = rest.slice(atom.length);
  }
  return true;
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
};

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
  if (typed && legal.length > 0 && !isGenericSearchAlias(typed)) {
    const alias = foldSearchAlias(typed);
    const insideLegal = legal.some((name) => foldSearchAlias(name).includes(alias));
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
