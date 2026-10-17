/**
 * `official_legal_events.source_catalog_id` allowlist for lookup + remote mutation scripts.
 * See docs/supabase.md §司法判詞匯入.
 */
export const OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST = [
  "legalref-lrs-ju",
] as const;

export type OfficialLegalEventSourceCatalogId =
  (typeof OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST)[number];

/** Primary D2 / Legal Ref batch catalog (sole allowlist entry today). */
export const DEFAULT_OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ID: OfficialLegalEventSourceCatalogId =
  OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST[0];

export function isOfficialLegalEventSourceCatalogAllowed(
  sourceCatalogId: string,
): boolean {
  return (
    OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST as readonly string[]
  ).includes(sourceCatalogId);
}

/** Spread for Supabase `.in("source_catalog_id", …)`. */
export function officialLegalEventSourceCatalogAllowlistValues(): string[] {
  return [...OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST];
}
