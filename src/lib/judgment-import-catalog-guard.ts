import {
  DEFAULT_OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ID,
  isOfficialLegalEventSourceCatalogAllowed,
  OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST,
  officialLegalEventSourceCatalogAllowlistValues,
} from "./legal-event-catalog-allowlist";

export {
  DEFAULT_OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ID,
  OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST,
  isOfficialLegalEventSourceCatalogAllowed,
  officialLegalEventSourceCatalogAllowlistValues,
};

/** Throws if any seed row uses a catalog outside the lookup/import allowlist. */
export function assertJudgmentSeedAllowedForRemoteImport<
  T extends { sourceCatalogId: string; caseRef: string },
>(rows: T[]): void {
  const disallowed = rows.filter(
    (r) => !isOfficialLegalEventSourceCatalogAllowed(r.sourceCatalogId),
  );
  if (disallowed.length === 0) return;
  const refs = disallowed.map((r) => `${r.sourceCatalogId}:${r.caseRef}`);
  const allowed = OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST.join(", ");
  throw new Error(
    `Judgment seed catalog not allowlisted for remote: ${refs.join(
      ", ",
    )}. Allowed: ${allowed}. Fixture-only rows stay in judgments-seed.json for unit tests.`,
  );
}

export function assertOfficialLegalEventCatalogAllowed(
  sourceCatalogId: string,
  context?: string,
): void {
  if (isOfficialLegalEventSourceCatalogAllowed(sourceCatalogId)) return;
  const allowed = OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST.join(", ");
  const prefix = context ? `${context}: ` : "";
  throw new Error(
    `${prefix}source_catalog_id "${sourceCatalogId}" is not allowlisted (allowed: ${allowed}).`,
  );
}

/** After SELECT — refuse deletes/updates on non-allowlisted catalogs. */
export function assertOfficialLegalEventRowsCatalogAllowed(
  rows: Array<{ source_catalog_id?: string | null; case_ref?: string }>,
): void {
  for (const row of rows) {
    const catalog = row.source_catalog_id;
    if (!catalog) {
      throw new Error(
        `official_legal_events row missing source_catalog_id (case_ref=${row.case_ref ?? "?"})`,
      );
    }
    assertOfficialLegalEventCatalogAllowed(
      catalog,
      row.case_ref ? `case_ref ${row.case_ref}` : undefined,
    );
  }
}
