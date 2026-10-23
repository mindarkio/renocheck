/**
 * Synthetic audit probes (company names starting `ZZQ_` or `ZZQ `).
 * NFKC first, so full-width `ＺＺＱ＿` / `ＺＺＱ　` count the same way the
 * CR prefix code already folds them.
 * Excluded from admin KPIs and rejected by production `/api/search`.
 * Test and development searches keep using these names.
 */
export function isSyntheticProbeTerm(term: string): boolean {
  return /^ZZQ[_\s]/i.test(term.normalize("NFKC").trim());
}
