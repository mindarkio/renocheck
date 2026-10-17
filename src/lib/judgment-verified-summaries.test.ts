import { describe, expect, it } from "vitest";
import {
  canonicalVerifiedRow,
  reconstructedFromDb,
  verifiedRowToDbUpdate,
} from "./judgment-verified-summaries";

describe("judgment-verified-summaries", () => {
  const row = {
    caseRef: "DCCJ 1/2020",
    sourceUrl: "https://example.test/ju",
    outcome_hint: "defendant_liable",
    hearing_points_source: "ai_verified" as const,
    points: [
      { point_index: 2, keyPointZh: "乙", sourceQuoteZh: "B" },
      { point_index: 1, keyPointZh: "甲", sourceQuoteZh: "A" },
    ],
  };

  it("sorts points by point_index for DB arrays", () => {
    const db = verifiedRowToDbUpdate(row);
    expect(db.hearing_key_points_zh).toEqual(["甲", "乙"]);
    expect(db.hearing_key_point_quotes_zh).toEqual(["A", "B"]);
    expect(db.hearing_points_source).toBe("ai_verified");
  });

  it("round-trips DB fields to canonical JSON", () => {
    const db = verifiedRowToDbUpdate(row);
    const rebuilt = reconstructedFromDb(row, {
      case_ref: row.caseRef,
      hearing_key_points_zh: db.hearing_key_points_zh,
      hearing_key_point_quotes_zh: db.hearing_key_point_quotes_zh,
      outcome_hint: db.outcome_hint,
      hearing_points_source: db.hearing_points_source,
    });
    expect(rebuilt).toEqual(canonicalVerifiedRow(row));
  });
});
