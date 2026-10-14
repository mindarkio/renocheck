import { resolveAuthoritativeSearchLabel } from "./entity-report-context";

function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")");
}

function stripCompanySuffix(label: string): string {
  return label
    .replace(/有限公司$/u, "")
    .replace(/有限責任公司$/u, "")
    .trim();
}

/** Substrings used for L1 hit binding (title + snippet + url). */
export function entityMatchTokens(
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: { mwcCompanyName?: string; phoneNormalized?: string },
): string[] {
  const primary = resolveAuthoritativeSearchLabel(input, opts);
  const tokens = new Set<string>();

  if (primary) {
    tokens.add(primary);
    const stripped = stripCompanySuffix(primary);
    if (stripped.length >= 2) tokens.add(stripped);
    if (stripped.length >= 4) {
      tokens.add(stripped.slice(0, Math.min(6, stripped.length)));
    }
  }

  if (opts?.mwcCompanyName?.trim()) {
    const mwc = opts.mwcCompanyName.trim();
    tokens.add(mwc);
    const mwcStripped = stripCompanySuffix(mwc);
    if (mwcStripped.length >= 2) tokens.add(mwcStripped);
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
