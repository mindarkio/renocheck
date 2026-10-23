/**
 * Synthetic audit probes (company names starting `ZZQ_` or `ZZQ `).
 * Excluded from admin KPIs and rejected by production `/api/search`.
 * Test and development searches keep using these names.
 */
export function isSyntheticProbeTerm(term: string): boolean {
  return /^ZZQ[_\s]/i.test(term.trim());
}
