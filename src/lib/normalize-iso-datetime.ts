/** Zod `z.string().datetime()` expects UTC `Z` suffix; Postgres often returns `+00:00`. */
export function normalizeIsoDatetimeForSchema(
  value: string | null | undefined,
): string | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString();
}
