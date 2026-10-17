import { describe, expect, it } from "vitest";
import {
  assertJudgmentSeedAllowedForRemoteImport,
  assertOfficialLegalEventCatalogAllowed,
  assertOfficialLegalEventRowsCatalogAllowed,
  isOfficialLegalEventSourceCatalogAllowed,
} from "./judgment-import-catalog-guard";

describe("judgment-import-catalog-guard", () => {
  it("re-exports allowlist check", () => {
    expect(isOfficialLegalEventSourceCatalogAllowed("legalref-lrs-ju")).toBe(
      true,
    );
    expect(isOfficialLegalEventSourceCatalogAllowed("judiciary-lrs-fixture")).toBe(
      false,
    );
  });

  it("rejects seed rows outside allowlist", () => {
    expect(() =>
      assertJudgmentSeedAllowedForRemoteImport([
        { sourceCatalogId: "legalref-lrs-ju", caseRef: "DCCJ 1/2020" },
        { sourceCatalogId: "judiciary-lrs-fixture", caseRef: "DCCJ 9001/2020" },
      ]),
    ).toThrow(/not allowlisted for remote/);
  });

  it("accepts legalref-lrs-ju-only seed", () => {
    expect(() =>
      assertJudgmentSeedAllowedForRemoteImport([
        { sourceCatalogId: "legalref-lrs-ju", caseRef: "DCCJ 1/2020" },
      ]),
    ).not.toThrow();
  });

  it("assertOfficialLegalEventCatalogAllowed throws for unknown catalog", () => {
    expect(() =>
      assertOfficialLegalEventCatalogAllowed("judiciary-lrs"),
    ).toThrow(/not allowlisted/);
  });

  it("assertOfficialLegalEventRowsCatalogAllowed guards batch rows", () => {
    expect(() =>
      assertOfficialLegalEventRowsCatalogAllowed([
        { source_catalog_id: "legalref-lrs-ju", case_ref: "DCCJ 1/2020" },
      ]),
    ).not.toThrow();
    expect(() =>
      assertOfficialLegalEventRowsCatalogAllowed([
        { source_catalog_id: "judiciary-lrs-fixture", case_ref: "HCSA 42/2019" },
      ]),
    ).toThrow(/not allowlisted/);
  });
});
