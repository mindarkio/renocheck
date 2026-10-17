import { describe, expect, it } from "vitest";
import { buildJudgmentImportDbRow } from "./judgment-import-row";
import { HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH } from "./judgment-hearing-summary";

const seed = {
  sourceCatalogId: "legalref-lrs-ju",
  caseRef: "DCCJ 1/2020",
  court: "District Court",
  eventDate: "2020-01-01",
  companyNameNormalized: "示例工程有限公司",
  judgmentCategory: "renovation_engineering_civil",
  partyRole: "defendant",
  hearingKeyPointsZh: [HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH],
  sourceUrl:
    "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=1&TP=JU",
};

describe("buildJudgmentImportDbRow", () => {
  it("sets placeholder hearing fields for new rows", () => {
    const row = buildJudgmentImportDbRow(seed);
    expect(row.hearing_points_source).toBe("placeholder");
    expect(row.hearing_key_point_quotes_zh).toEqual([]);
    expect(row.hearing_key_points_zh).toEqual([
      HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH,
    ]);
  });

  it("does not overwrite ai_verified hearing fields on existing row", () => {
    const row = buildJudgmentImportDbRow(seed, {
      hearing_points_source: "ai_verified",
      hearing_key_points_zh: ["已核對要點"],
      hearing_key_point_quotes_zh: ["quote"],
      outcome_hint: "defendant_liable",
      review_status: "human_verified",
    });
    expect(row.hearing_points_source).toBe("ai_verified");
    expect(row.hearing_key_points_zh).toEqual(["已核對要點"]);
    expect(row.hearing_key_point_quotes_zh).toEqual(["quote"]);
    expect(row.outcome_hint).toBe("defendant_liable");
    expect(row.hearing_key_points_zh).not.toEqual(seed.hearingKeyPointsZh);
  });
});
