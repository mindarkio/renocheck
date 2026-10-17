/**
 * Catalog IDs allowed only in repo fixtures / unit tests — never upserted to cloud remote.
 * See docs/supabase.md §司法判詞匯入.
 */
export const REMOTE_BLOCKED_JUDGMENT_CATALOG_IDS = [
  "judiciary-lrs-fixture",
] as const;

export type RemoteBlockedJudgmentCatalogId =
  (typeof REMOTE_BLOCKED_JUDGMENT_CATALOG_IDS)[number];

export function isRemoteBlockedJudgmentCatalog(
  sourceCatalogId: string,
): boolean {
  return (REMOTE_BLOCKED_JUDGMENT_CATALOG_IDS as readonly string[]).includes(
    sourceCatalogId,
  );
}

export function findRemoteBlockedJudgmentSeedRows<
  T extends { sourceCatalogId: string; caseRef: string },
>(rows: T[]): T[] {
  return rows.filter((r) => isRemoteBlockedJudgmentCatalog(r.sourceCatalogId));
}

/** Throws if any seed row targets a fixture-only catalog (cloud import scripts). */
export function assertJudgmentSeedAllowedForRemoteImport<
  T extends { sourceCatalogId: string; caseRef: string },
>(rows: T[]): void {
  const blocked = findRemoteBlockedJudgmentSeedRows(rows);
  if (blocked.length === 0) return;
  const refs = blocked.map((r) => `${r.sourceCatalogId}:${r.caseRef}`);
  throw new Error(
    `Judgment import blocked for fixture-only catalog(s) on remote: ${refs.join(
      ", ",
    )}. Use judgments-seed.json in tests only; production seed must use legalref-lrs-ju (or other approved catalogs).`,
  );
}
