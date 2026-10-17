/** Longest-prefix match on normalized case ref (e.g. HCSA64/2017 → HCSA). */
export function courtFromCaseRef(
  caseRef: string,
  prefixes: Record<string, string>,
): string | undefined {
  const normalized = caseRef.replace(/\s+/g, "").toUpperCase();
  const keys = Object.keys(prefixes).sort((a, b) => b.length - a.length);
  for (const prefix of keys) {
    if (normalized.startsWith(prefix.toUpperCase())) {
      return prefixes[prefix];
    }
  }
  return undefined;
}
