/**
 * Normalize HK phone for matching (8-digit local, digits only).
 * Multi-value fields (e.g. "6123 0898 / 9799 0973") use the first segment.
 */
export function normalizeHongKongPhone(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;

  const first = raw.split(/[/,、|]/)[0]?.trim() ?? "";
  const digits = first.replace(/\D/g, "");

  if (digits.length === 8) return digits;
  if (digits.length === 11 && digits.startsWith("852")) return digits.slice(3);
  if (digits.length > 8) return digits.slice(-8);

  return null;
}
