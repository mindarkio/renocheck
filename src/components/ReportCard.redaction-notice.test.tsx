// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReportCard } from "./ReportCard";
import { DISCLAIMER_VERSION, REPORT_VERSION } from "@/lib/constants";
import { buildEvaluationStub } from "@/lib/evaluation-stub";
import type { RiskReport } from "@/lib/report-schema";
import { THIRD_PARTY_REDACTION_NOTICE_ZH } from "@/lib/report-trust-copy-zh";

afterEach(() => {
  cleanup();
});

function report(withHighlight: boolean): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: false,
    boundHitCount: withHighlight ? 1 : 0,
    highlightCount: withHighlight ? 1 : 0,
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
      discussionCount: withHighlight ? 1 : 0,
      themes: withHighlight ? ["溝通"] : [],
      highlights: withHighlight
        ? [
            {
              summaryZh: "公開討論提及工期。",
              url: "https://example.com/thread/1",
              sourceName: "示例討論區",
            },
          ]
        : [],
      retrievalEvidence: [],
      contractChecklist: ["佔位"],
      actionableClauses: [],
    },
    disclaimerVersion: DISCLAIMER_VERSION,
    generatedAt: "2026-10-18T12:00:00.000Z",
  };
}

describe("ReportCard third-party redaction notice", () => {
  it("renders the approved notice under the AI summary", () => {
    render(<ReportCard report={report(false)} />);
    const summaryRegion = document.getElementById("summary-heading")?.parentElement;
    expect(summaryRegion?.textContent).toContain("查證摘要");
    expect(summaryRegion?.textContent).toContain(THIRD_PARTY_REDACTION_NOTICE_ZH);
    const summary = screen.getByText("公開資料摘要。");
    const notice = screen.getByText(THIRD_PARTY_REDACTION_NOTICE_ZH);
    expect(notice.getAttribute("role")).toBe("note");
    expect(
      summary.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(notice.className).toContain("text-primary-foreground/80");
    expect(screen.getAllByText(THIRD_PARTY_REDACTION_NOTICE_ZH)).toHaveLength(1);
  });

  it("keeps the notice above cited discussion cards", () => {
    render(<ReportCard report={report(true)} />);
    const notice = screen.getByText(THIRD_PARTY_REDACTION_NOTICE_ZH);
    const cited = document.getElementById("highlights-heading");
    expect(cited).toBeTruthy();
    expect(
      notice.compareDocumentPosition(cited!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
