// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { ReportCard } from "./ReportCard";
import { REPORT_VERSION } from "@/lib/constants";
import { buildEvaluationStub } from "@/lib/evaluation-stub";
import type { RiskReport } from "@/lib/report-schema";
import { LEGAL_LOOKUP_DEGRADED_SECTION_ZH } from "@/lib/legal-event-display";
import {
  NEXT_STEPS_HEADING_ZH,
  REPORT_SCOPE_LIMITS_HEADING_ZH,
  UNVERIFIED_COMPANY_REGISTRATION_HEADING_ZH,
} from "@/lib/report-trust-copy-zh";
import { summaryZhForLegalLookupDegraded } from "@/lib/search-pipeline-legal-summary";

afterEach(() => {
  cleanup();
});

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

    render(<ReportCard report={report} />);
    expect(screen.getByText("中性", { selector: "p" })).toBeTruthy();
    expect(screen.queryByText(/「未見負面摘要」僅表示/)).toBeNull();
    expect(screen.getByText(LEGAL_LOOKUP_DEGRADED_SECTION_ZH)).toBeTruthy();
    expect(screen.getByText(report.summaryZh)).toBeTruthy();
    expect(
      screen.getByText(
        "目前僅找到少量公開來源摘要，請自行核實是否與本次查詢對象為同一商號。",
      ),
    ).toBeTruthy();
    expect(screen.getByText(NEXT_STEPS_HEADING_ZH)).toBeTruthy();
    expect(screen.getByText(REPORT_SCOPE_LIMITS_HEADING_ZH)).toBeTruthy();
    expect(
      screen.queryByText(UNVERIFIED_COMPANY_REGISTRATION_HEADING_ZH),
    ).toBeNull();
  });
});

function minimalReport(overrides: Partial<RiskReport> = {}): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: false,
    boundHitCount: 0,
    highlightCount: 0,
  });
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "合成測試有限公司",
      matchType: "company_name",
      queryEcho: "合成測試有限公司",
      searchLabelUsed: "合成測試有限公司",
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "medium",
    evaluation,
    summaryZh: "公開資料摘要。",
    official: { mwcMatched: false, legalLookupStatus: "ok" },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      contractChecklist: ["佔位"],
      actionableClauses: [],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-18T12:00:00.000Z",
    ...overrides,
  };
}

describe("ReportCard report trust (PR-BC)", () => {
  it("shows unverified registration alert at top when triggered", () => {
    render(<ReportCard report={minimalReport()} />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(
      UNVERIFIED_COMPANY_REGISTRATION_HEADING_ZH,
    );
  });

  it("always shows next steps and scope limits", () => {
    render(
      <ReportCard
        report={minimalReport({
          official: { mwcMatched: true },
        })}
      />,
    );
    expect(screen.getByText(NEXT_STEPS_HEADING_ZH)).toBeTruthy();
    expect(screen.getByText(REPORT_SCOPE_LIMITS_HEADING_ZH)).toBeTruthy();
    expect(
      screen.queryByText(UNVERIFIED_COMPANY_REGISTRATION_HEADING_ZH),
    ).toBeNull();
  });
});
