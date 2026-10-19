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

  it("defendant_not_liable does not floor", () => {
    const floors = computeLegalFloors(
      [
        ev({
          judgmentCategory: "renovation_engineering_civil",
          partyRole: "defendant",
          outcomeHint: "defendant_not_liable",
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
          outcomeHint: "defendant_liable",
        }),
      ],
      0,
      "2026-01-15T12:00:00.000Z",
    );
    expect(floors?.riskBandZh).toBe("風險中等");
    expect(floors?.disputeLevel).toBe("historical_isolated");
  });
});

describe("employment_renovation floors", () => {
  const generatedAt = "2026-10-19T00:00:00.000Z";

  it("dedupes same neutral citation → 風險中等, matchedCount 1", () => {
    const events = [
      ev({
        judgmentCategory: "employment_renovation",
        partyRole: "defendant",
        outcomeHint: "defendant_liable",
        eventDate: "2025-02-10",
        caseRef: "HCLA901/2024",
        neutralCitation: "[2025] HKCFI 9901",
        sourceUrl:
          "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=1&TP=JU",
      }),
      ev({
        judgmentCategory: "employment_renovation",
        partyRole: "defendant",
        outcomeHint: "defendant_liable",
        eventDate: "2025-02-09",
        caseRef: "HCLA903/2024",
        neutralCitation: "[2025] HKCFI 9901",
        sourceUrl:
          "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=2&TP=JU",
      }),
    ];
    const floors = computeLegalFloors(events, 0, generatedAt);
    expect(floors?.riskBandZh).toBe("風險中等");
    expect(floors?.disputeLevel).toBe("active_concerning");
    const out = applyLegalEventFloors(baseReport({ generatedAt }), events, 0);
    expect(out.grade).toBe("C");
    expect(out.evaluation.riskBandZh).toBe("風險中等");
    expect(out.evaluation.legalTrack?.matchedCount).toBe(1);
  });

  it("partial outcome → 風險中等", () => {
    const floors = computeLegalFloors(
      [
        ev({
          judgmentCategory: "employment_renovation",
          partyRole: "defendant",
          outcomeHint: "partial",
          eventDate: "2025-02-10",
        }),
      ],
      0,
      generatedAt,
    );
    expect(floors?.riskBandZh).toBe("風險中等");
  });

  it("non-liable outcomes do not floor", () => {
    for (const outcomeHint of [
      "defendant_not_liable",
      "procedural_only",
      "unclear",
      undefined,
    ] as const) {
      const floors = computeLegalFloors(
        [
          ev({
            judgmentCategory: "employment_renovation",
            partyRole: "defendant",
            ...(outcomeHint ? { outcomeHint } : {}),
          }),
        ],
        0,
        generatedAt,
      );
      expect(floors).toBeNull();
    }
  });

  it("two distinct neutral citations → 風險偏高", () => {
    const floors = computeLegalFloors(
      [
        ev({
          judgmentCategory: "employment_renovation",
          partyRole: "defendant",
          outcomeHint: "defendant_liable",
          eventDate: "2025-02-10",
          neutralCitation: "[2025] HKCFI 9901",
          sourceUrl:
            "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=10&TP=JU",
        }),
        ev({
          judgmentCategory: "employment_renovation",
          partyRole: "defendant",
          outcomeHint: "defendant_liable",
          eventDate: "2024-02-10",
          neutralCitation: "[2024] HKCFI 9902",
          sourceUrl:
            "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=11&TP=JU",
        }),
      ],
      0,
      generatedAt,
    );
    expect(floors?.riskBandZh).toBe("風險偏高");
    const out = applyLegalEventFloors(baseReport({ generatedAt }), [
      ev({
        judgmentCategory: "employment_renovation",
        partyRole: "defendant",
        outcomeHint: "defendant_liable",
        eventDate: "2025-02-10",
        neutralCitation: "[2025] HKCFI 9901",
        sourceUrl:
          "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=10&TP=JU",
      }),
      ev({
        judgmentCategory: "employment_renovation",
        partyRole: "defendant",
        outcomeHint: "defendant_liable",
        eventDate: "2024-02-10",
        neutralCitation: "[2024] HKCFI 9902",
        sourceUrl:
          "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=11&TP=JU",
      }),
    ], 0);
    expect(out.grade).toBe("D");
  });

  it("employment_labour defendant_liable does not raise band", () => {
    const floors = computeLegalFloors(
      [
        ev({
          judgmentCategory: "employment_labour",
          partyRole: "defendant",
          outcomeHint: "defendant_liable",
          neutralCitation: "[2025] HKCFI 9901",
          sourceUrl:
            "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=20&TP=JU",
        }),
        ev({
          judgmentCategory: "employment_labour",
          partyRole: "defendant",
          outcomeHint: "defendant_liable",
          neutralCitation: "[2024] HKCFI 9902",
          sourceUrl:
            "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=21&TP=JU",
        }),
      ],
      0,
      generatedAt,
    );
    expect(floors).toBeNull();
  });

  it("renovation civil same neutral dedupes to one 風險中等", () => {
    const floors = computeLegalFloors(
      [
        ev({
          judgmentCategory: "renovation_engineering_civil",
          partyRole: "defendant",
          outcomeHint: "defendant_liable",
          eventDate: "2025-02-10",
          neutralCitation: "[2025] HKCFI 8801",
          sourceUrl:
            "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=30&TP=JU",
        }),
        ev({
          judgmentCategory: "renovation_engineering_civil",
          partyRole: "defendant",
          outcomeHint: "defendant_liable",
          eventDate: "2025-02-09",
          neutralCitation: "[2025] HKCFI 8801",
          sourceUrl:
            "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=31&TP=JU",
        }),
      ],
      0,
      generatedAt,
    );
    expect(floors?.riskBandZh).toBe("風險中等");
  });

  it("dedupes by matching DIS when no neutralCitation", () => {
    const url =
      "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=55555&TP=JU";
    const floors = computeLegalFloors(
      [
        ev({
          judgmentCategory: "employment_renovation",
          partyRole: "defendant",
          outcomeHint: "defendant_liable",
          eventDate: "2025-02-10",
          caseRef: "HCLA901/2024",
          sourceUrl: url,
        }),
        ev({
          judgmentCategory: "employment_renovation",
          partyRole: "defendant",
          outcomeHint: "defendant_liable",
          eventDate: "2025-02-09",
          caseRef: "HCLA903/2024",
          sourceUrl: url,
        }),
      ],
      0,
      generatedAt,
    );
    expect(floors?.riskBandZh).toBe("風險中等");
    const out = applyLegalEventFloors(baseReport({ generatedAt }), [
      ev({
        judgmentCategory: "employment_renovation",
        partyRole: "defendant",
        outcomeHint: "defendant_liable",
        eventDate: "2025-02-10",
        caseRef: "HCLA901/2024",
        sourceUrl: url,
      }),
      ev({
        judgmentCategory: "employment_renovation",
        partyRole: "defendant",
        outcomeHint: "defendant_liable",
        eventDate: "2025-02-09",
        caseRef: "HCLA903/2024",
        sourceUrl: url,
      }),
    ], 0);
    expect(out.evaluation.legalTrack?.matchedCount).toBe(1);
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
