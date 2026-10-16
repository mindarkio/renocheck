import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { OfficialLegalEvent } from "./legal-event-schema";
import {
  applyLegalEventFloors,
  computeLegalFloors,
} from "./legal-event-calibration";
import type { RiskReport } from "./report-schema";

function baseReport(overrides?: Partial<RiskReport>): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "low",
    mwcMatched: false,
    boundHitCount: 0,
    highlightCount: 0,
  });
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "測試",
      matchType: "company_name",
      queryEcho: "測試",
      searchLabelUsed: "測試",
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "low",
    evaluation: { ...evaluation, riskBandZh: "中性" },
    summaryZh: "測試摘要",
    official: { mwcMatched: false },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      contractChecklist: ["測試？"],
      actionableClauses: [],
      boundHitCount: 0,
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

function ev(partial: Partial<OfficialLegalEvent> & Pick<OfficialLegalEvent, "judgmentCategory" | "partyRole">): OfficialLegalEvent {
  return {
    sourceType: "court_judgment",
    caseRef: "TEST/1",
    court: "Test Court",
    eventDate: "2024-01-01",
    hearingKeyPointsZh: ["要點"],
    sourceUrl: "https://example.com/judgment",
    matchReasonZh: "測試",
    ...partial,
  };
}

describe("computeLegalFloors", () => {
  it("defendant small_claims_debt raises band when bound=0", () => {
    const floors = computeLegalFloors(
      [ev({ judgmentCategory: "small_claims_debt", partyRole: "defendant" })],
      0,
      "2026-01-15T12:00:00.000Z",
    );
    expect(floors?.riskBandZh).toBe("風險中等");
  });

  it("defendant employment_labour does not raise band when bound=0", () => {
    const floors = computeLegalFloors(
      [ev({ judgmentCategory: "employment_labour", partyRole: "defendant" })],
      0,
      "2026-01-15T12:00:00.000Z",
    );
    expect(floors).toBeNull();
  });

  it("dismissed_or_withdrawn does not floor", () => {
    const floors = computeLegalFloors(
      [
        ev({
          judgmentCategory: "renovation_engineering_civil",
          partyRole: "defendant",
          outcomeHint: "dismissed_or_withdrawn",
        }),
      ],
      0,
      "2026-01-15T12:00:00.000Z",
    );
    expect(floors).toBeNull();
  });

  it("plaintiff does not floor", () => {
    const floors = computeLegalFloors(
      [
        ev({
          judgmentCategory: "renovation_engineering_civil",
          partyRole: "plaintiff",
        }),
      ],
      0,
      "2026-01-15T12:00:00.000Z",
    );
    expect(floors).toBeNull();
  });

  it("interlocutory downgrades renovation civil floor", () => {
    const floors = computeLegalFloors(
      [
        ev({
          judgmentCategory: "renovation_engineering_civil",
          partyRole: "defendant",
          procedureStage: "interlocutory",
        }),
      ],
      0,
      "2026-01-15T12:00:00.000Z",
    );
    expect(floors?.riskBandZh).toBe("中性");
  });

  it("old event caps at 風險中等", () => {
    const floors = computeLegalFloors(
      [
        ev({
          judgmentCategory: "renovation_engineering_civil",
          partyRole: "defendant",
          eventDate: "2010-01-01",
          outcomeHint: "judgment_against_defendant",
        }),
      ],
      0,
      "2026-01-15T12:00:00.000Z",
    );
    expect(floors?.riskBandZh).toBe("風險中等");
    expect(floors?.disputeLevel).toBe("historical_isolated");
  });
});

describe("applyLegalEventFloors", () => {
  it("merges with existing evaluation", () => {
    const report = baseReport();
    const out = applyLegalEventFloors(
      report,
      [ev({ judgmentCategory: "small_claims_debt", partyRole: "defendant" })],
      0,
    );
    expect(out.evaluation.riskBandZh).toBe("風險中等");
    expect(out.evaluation.legalTrack?.matchedCount).toBe(1);
  });
});
