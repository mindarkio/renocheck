/** Matches `purge_returning_user_anon_ids()`: `created_at < now() - interval '90 days'`. */
export const ANON_ID_RETENTION_DAYS = 90;
export const ANON_ID_RETENTION_MS = ANON_ID_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * True when the anonymous id on this row is due to be cleared.
 * The row itself stays. An unparseable timestamp is left alone.
 */
export function anonIdPastRetention(createdAt: string | Date, now: Date): boolean {
  const at = createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
  if (!Number.isFinite(at)) return false;
  return at < now.getTime() - ANON_ID_RETENTION_MS;
}
