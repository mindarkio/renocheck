function decodeHtmlEntities(label: string): string {
  return label
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

/** Variants for mwc_contractors.company_name ilike (P2-C3: punctuation / BR mismatch). */
export function mwcCompanyNameLookupTerms(companyName: string): string[] {
  const raw = decodeHtmlEntities(companyName.replace(/%/g, "").trim());
  if (!raw) return [];

  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length >= 2) seen.add(t);
  };

  const expandLtd = (s: string) => {
    add(s);
    add(s.replace(/\bLTD\.?\b/gi, "LIMITED"));
    add(s.replace(/\bLIMITED\b/gi, "LTD"));
    add(s.replace(/\bCO\.?\b/gi, "COMPANY"));
    add(s.replace(/\bCOMPANY\b/gi, "CO"));
  };

  expandLtd(raw);
  expandLtd(raw.replace(/（/g, "(").replace(/）/g, ")"));
  expandLtd(raw.replace(/[（）()]/gu, "").replace(/\s+/g, " "));
  const stripped = raw
    .replace(/有限公司$/u, "")
    .replace(/有限責任公司$/u, "")
    .trim();
  expandLtd(stripped);
  expandLtd(stripped.replace(/[（）()]/gu, "").replace(/\s+/g, " "));

  return [...seen];
}
