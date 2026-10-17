import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportCard } from "./ReportCard";
import { REPORT_VERSION } from "@/lib/constants";
import { buildEvaluationStub } from "@/lib/evaluation-stub";
import type { RiskReport } from "@/lib/report-schema";
import { LEGAL_LOOKUP_DEGRADED_ZH } from "@/lib/legal-event-display";

function degradedReport(): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: false,
    boundHitCount: 0,
    highlightCount: 1,
  });
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "測試裝修有限公司",
      matchType: "company_name",
      queryEcho: "測試裝修有限公司",
      searchLabelUsed: "測試裝修有限公司",
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "medium",
    evaluation: {
      ...evaluation,
      riskBandZh: "未見負面摘要",
      reputationTrack: {
        disputeLevel: "none_detected",
        recentDisputeCount: 0,
      },
    },
    summaryZh: "判詞紀錄暫時未能查詢，本次評級未計入判詞。摘要",
    official: { mwcMatched: false, legalLookupStatus: "timeout" },
    signals: {
      discussionCount: 1,
      themes: ["裝修"],
      highlights: [
        {
          summaryZh: "討論摘要",
          url: "https://example.com/t/1",
        },
      ],
      retrievalEvidence: [],
      actionableClauses: [],
      contractChecklist: ["有無書面合約？"],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-17T12:00:00.000Z",
  };
}

describe("ReportCard legal lookup degraded", () => {
  it("shows 中性 in hero and hides 未見負面摘要 footer", () => {
    const html = renderToStaticMarkup(<ReportCard report={degradedReport()} />);
    expect(html).toContain(">中性</p>");
    expect(html).not.toContain("「未見負面摘要」僅表示");
    expect(html).toContain(LEGAL_LOOKUP_DEGRADED_ZH);
  });
});
