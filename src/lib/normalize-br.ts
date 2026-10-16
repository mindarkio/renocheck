/** HK business registration number — digits only, up to 8. */
export function normalizeBrDigits(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 8) return undefined;
  return digits.padStart(8, "0");
}

/** BR from seed/import only — MWC registration numbers are not BRs. */
export function brNormalizedFromSeedField(
  raw?: string | null,
): string | undefined {
  if (!raw?.trim()) return undefined;
  if (/\bMWC\b/i.test(raw)) return undefined;
  return normalizeBrDigits(raw);
}
