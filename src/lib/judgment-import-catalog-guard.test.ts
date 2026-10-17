import { describe, expect, it } from "vitest";
import {
  assertJudgmentSeedAllowedForRemoteImport,
  findRemoteBlockedJudgmentSeedRows,
  isRemoteBlockedJudgmentCatalog,
} from "./judgment-import-catalog-guard";

describe("judgment-import-catalog-guard", () => {
  it("blocks judiciary-lrs-fixture for remote import", () => {
    expect(isRemoteBlockedJudgmentCatalog("judiciary-lrs-fixture")).toBe(true);
    expect(isRemoteBlockedJudgmentCatalog("legalref-lrs-ju")).toBe(false);
  });

  it("finds blocked rows in a mixed seed", () => {
    const rows = [
      { sourceCatalogId: "legalref-lrs-ju", caseRef: "DCCJ 1/2020" },
      { sourceCatalogId: "judiciary-lrs-fixture", caseRef: "DCCJ 9001/2020" },
    ];
    expect(findRemoteBlockedJudgmentSeedRows(rows)).toHaveLength(1);
    expect(findRemoteBlockedJudgmentSeedRows(rows)[0].caseRef).toBe(
      "DCCJ 9001/2020",
    );
  });

  it("assert throws when fixture catalog present", () => {
    expect(() =>
      assertJudgmentSeedAllowedForRemoteImport([
        { sourceCatalogId: "judiciary-lrs-fixture", caseRef: "HCSA 42/2019" },
      ]),
    ).toThrow(/fixture-only catalog/);
  });

  it("assert passes for legalref-lrs-ju only seed", () => {
    expect(() =>
      assertJudgmentSeedAllowedForRemoteImport([
        { sourceCatalogId: "legalref-lrs-ju", caseRef: "DCCJ 1/2020" },
      ]),
    ).not.toThrow();
  });
});
