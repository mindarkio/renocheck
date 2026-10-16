import { normalizeCompanyNameForCompare } from "./entity-report-context";
import { mwcCompanyNameLookupTerms } from "./mwc-company-search-terms";

/** Deterministic alias suggestions from import party / company label (D2 assist). */
export function suggestLookupAliases(
  companyNameNormalized: string,
  partyNames?: string[],
): string[] {
  const seen = new Set<string>();
  const add = (raw: string) => {
    const t = raw.trim();
    if (t.length < 2) return;
    if (t === companyNameNormalized.trim()) return;
    seen.add(t);
  };

  const jingyingMatch = companyNameNormalized.match(/經營(.+)$/u);
  if (jingyingMatch?.[1]) add(jingyingMatch[1].trim());

  const commaOp = companyNameNormalized.match(/^[^，,]+[，,]\s*[^，,]+經營(.+)$/u);
  if (commaOp?.[1]) add(commaOp[1].trim());

  const taMatch = companyNameNormalized.match(/\bt\/a\s+(.+)$/iu);
  if (taMatch?.[1]) add(taMatch[1].trim());

  const tradingAs = companyNameNormalized.match(/\btrading as\s+(.+)$/iu);
  if (tradingAs?.[1]) add(tradingAs[1].trim());

  for (const p of partyNames ?? []) {
    const pJingying = p.match(/經營(.+)$/u);
    if (pJingying?.[1]) add(pJingying[1].trim());
    const pt = p.match(/\btrading as\s+(.+)$/iu);
    if (pt?.[1]) add(pt[1].trim());
    const pta = p.match(/\bt\/a\s+(.+)$/iu);
    if (pta?.[1]) add(pta[1].trim());
  }

  return [...seen];
}

export function normalizeLookupAliases(
  companyNameNormalized: string,
  extras?: string[],
): string[] {
  const primary = normalizeCompanyNameForCompare(companyNameNormalized);
  const out = new Set<string>();
  for (const raw of extras ?? []) {
    const n = normalizeCompanyNameForCompare(raw);
    if (n.length < 2 || n === primary) continue;
    out.add(n);
  }
  return [...out];
}

export type LegalRowMatchFields = {
  company_name_normalized: string;
  lookup_aliases?: string[] | null;
};

/** Whether user search label matches this imported row (company + aliases). */
export function legalRowMatchesSearchLabel(
  searchLabelUsed: string,
  row: LegalRowMatchFields,
): boolean {
  const labelNorm = normalizeCompanyNameForCompare(searchLabelUsed);
  if (labelNorm.length < 2) return false;

  const rowNorm = normalizeCompanyNameForCompare(row.company_name_normalized);
  const aliasNorms = (row.lookup_aliases ?? []).map((a) =>
    normalizeCompanyNameForCompare(a),
  );

  const normsMatch = (a: string, b: string) => {
    if (a === b && a.length >= 2) return true;
    return (
      a.length >= 4 &&
      b.length >= 4 &&
      (a.includes(b) || b.includes(a))
    );
  };

  for (const term of mwcCompanyNameLookupTerms(searchLabelUsed)) {
    const termNorm = normalizeCompanyNameForCompare(term);
    if (termNorm.length < 2) continue;
    if (normsMatch(termNorm, rowNorm)) return true;
    for (const an of aliasNorms) {
      if (normsMatch(termNorm, an)) return true;
      if (normsMatch(termNorm, rowNorm)) return true;
    }
  }

  if (normsMatch(labelNorm, rowNorm)) return true;
  for (const an of aliasNorms) {
    if (normsMatch(labelNorm, an)) return true;
  }

  return false;
}
