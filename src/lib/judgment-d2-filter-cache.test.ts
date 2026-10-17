import { describe, expect, it } from "vitest";
import type { JudgmentCandidateRow } from "./judgment-candidates-schema";
import { judgmentCandidateContentHash } from "./judgment-d2-filter-cache";
import { manualTriageRevisionHash } from "./judgment-d2-manual-triage";

const sampleRow = {
  caseRef: "DCCJ 1/2020",
  partiesLine: "甲 訴 乙工程有限公司",
  eventDate: "2020-01-01",
  database: "ju",
  discoveredFrom: { profileId: "tier_a" },
} as JudgmentCandidateRow;

describe("judgmentCandidateContentHash", () => {
  it("includes manual triage revision in hash", () => {
    const hash = judgmentCandidateContentHash(sampleRow, "test_mwc_snapshot");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(manualTriageRevisionHash()).toHaveLength(16);
  });
});
