/** Canonical case_ref key (no spaces, upper) — used for import keys and verified JSON matching. */
export function judgmentCaseRefKey(caseRef: string): string {
  return caseRef.replace(/\s+/g, "").toUpperCase();
}

/** Storage/display form before writing `official_legal_events.case_ref`. */
export function normalizeJudgmentCaseRefForStorage(caseRef: string): string {
  const compact = caseRef.replace(/\s+/g, "");
  const m = compact.match(/^([A-Z]{2,6})(\d+\/\d{4})$/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  return caseRef.trim().replace(/\s+/g, " ");
}

export function judgmentCaseRefStorageDrift(stored: string): {
  normalized: string;
  changed: boolean;
} {
  const normalized = normalizeJudgmentCaseRefForStorage(stored);
  return { normalized, changed: normalized !== stored };
}
