/** Variants for mwc_contractors.company_name ilike (P2-C3: punctuation / BR mismatch). */
export function mwcCompanyNameLookupTerms(companyName: string): string[] {
  const raw = companyName.replace(/%/g, "").trim();
  if (!raw) return [];

  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length >= 2) seen.add(t);
  };

  add(raw);
  add(raw.replace(/（/g, "(").replace(/）/g, ")"));
  add(raw.replace(/[（）()]/gu, "").replace(/\s+/g, ""));
  const stripped = raw
    .replace(/有限公司$/u, "")
    .replace(/有限責任公司$/u, "")
    .trim();
  add(stripped);
  add(stripped.replace(/[（）()]/gu, "").replace(/\s+/g, ""));

  return [...seen];
}
