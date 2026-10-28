/**
 * Company name handed from the upload page to the result view, in memory only.
 * Not localStorage or IndexedDB. A reload drops it. The stored copy is the
 * server-side extracted/confirmed name columns.
 */
const held = new Map<string, string | null>();

export function holdQuoteCompanyName(analysisId: string, name: string | null): void {
  held.set(analysisId, name);
}

export function readQuoteCompanyName(
  analysisId: string,
): { present: true; name: string | null } | { present: false } {
  if (!held.has(analysisId)) return { present: false };
  return { present: true, name: held.get(analysisId) ?? null };
}

export function clearQuoteCompanyNamesForTests(): void {
  held.clear();
}
