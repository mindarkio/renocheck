import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportCard } from "./ReportCard";
import { REPORT_VERSION } from "@/lib/constants";
import { buildEvaluationStub } from "@/lib/evaluation-stub";
import type { RiskReport } from "@/lib/report-schema";
import { LEGAL_LOOKUP_DEGRADED_ZH } from "@/lib/legal-event-display";
import { summaryZhForLegalLookupDegraded } from "@/lib/search-pipeline-legal-summary";

function degradedReport(): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: false,
    boundHitCount: 0,
    highlightCount: 1,
  });
  const baseSummary = "公開討論未見負面摘要，建議自行核實。";
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
    summaryZh: summaryZhForLegalLookupDegraded(baseSummary),
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
    const report = degradedReport();
    expect(report.summaryZh).not.toContain("未見負面摘要");
    expect(report.summaryZh).toContain("建議自行核實");

    const html = renderToStaticMarkup(<ReportCard report={report} />);
    expect(html).toContain(">中性</p>");
    expect(html).not.toContain("「未見負面摘要」僅表示");
    expect(html).toContain(LEGAL_LOOKUP_DEGRADED_ZH);
    expect(html).toContain(report.summaryZh);
  });
});
