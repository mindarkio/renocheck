import { describe, expect, it } from "vitest";
import {
  judgmentCaseRefKey,
  judgmentCaseRefStorageDrift,
  normalizeJudgmentCaseRefForStorage,
} from "./judgment-case-ref";
import { judgmentImportRowKey } from "./judgment-import-row";

describe("judgment-case-ref", () => {
  it("normalizes storage form with court prefix spacing", () => {
    expect(normalizeJudgmentCaseRefForStorage("dccj1/2020")).toBe("DCCJ 1/2020");
    expect(normalizeJudgmentCaseRefForStorage("DCCJ  1/2020")).toBe(
      "DCCJ 1/2020",
    );
  });

  it("judgmentCaseRefKey matches import row key segment", () => {
    const ref = "DCCJ  1/2020";
    expect(judgmentCaseRefKey(ref)).toBe("DCCJ1/2020");
    expect(judgmentImportRowKey("legalref-lrs-ju", ref)).toBe(
      "legalref-lrs-ju|DCCJ1/2020",
    );
  });

  it("detects storage drift", () => {
    expect(judgmentCaseRefStorageDrift("DCCJ 1/2020").changed).toBe(false);
    expect(judgmentCaseRefStorageDrift("dccj1/2020").changed).toBe(true);
    expect(judgmentCaseRefStorageDrift("dccj1/2020").normalized).toBe(
      "DCCJ 1/2020",
    );
  });
});
