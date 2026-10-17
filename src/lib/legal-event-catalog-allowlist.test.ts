import { describe, expect, it } from "vitest";
import {
  DEFAULT_OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ID,
  isOfficialLegalEventSourceCatalogAllowed,
  OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST,
  officialLegalEventSourceCatalogAllowlistValues,
} from "./legal-event-catalog-allowlist";

describe("legal-event-catalog-allowlist", () => {
  it("allowlists only legalref-lrs-ju", () => {
    expect(OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST).toEqual([
      "legalref-lrs-ju",
    ]);
    expect(DEFAULT_OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ID).toBe(
      "legalref-lrs-ju",
    );
    expect(isOfficialLegalEventSourceCatalogAllowed("legalref-lrs-ju")).toBe(
      true,
    );
    expect(isOfficialLegalEventSourceCatalogAllowed("judiciary-lrs-fixture")).toBe(
      false,
    );
    expect(isOfficialLegalEventSourceCatalogAllowed("judiciary-lrs")).toBe(
      false,
    );
  });

  it("exports values for Supabase .in()", () => {
    expect(officialLegalEventSourceCatalogAllowlistValues()).toEqual([
      "legalref-lrs-ju",
    ]);
  });
});
