/**
 * Company name for the current browser view only.
 * Not localStorage, IndexedDB, or the server. A reload drops it.
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
