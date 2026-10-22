// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReportCard } from "./ReportCard";
import { DISCLAIMER_VERSION, REPORT_VERSION } from "@/lib/constants";
import { buildEvaluationStub } from "@/lib/evaluation-stub";
import type { RetrievalEvidenceItem, RiskReport } from "@/lib/report-schema";

afterEach(() => {
  cleanup();
});

function reportWithEvidence(items: RetrievalEvidenceItem[]): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: false,
    boundHitCount: items.length,
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
      highlights: [],
      retrievalEvidence: items,
      contractChecklist: ["佔位"],
      actionableClauses: [],
    },
    disclaimerVersion: DISCLAIMER_VERSION,
    generatedAt: "2026-10-18T12:00:00.000Z",
  };
}

function evidenceText(report: RiskReport): string {
  const { container } = render(<ReportCard report={report} />);
  const block = container
    .querySelector("#retrieval-evidence-heading")
    ?.closest("section");
  return block?.textContent ?? "";
}

describe("ReportCard evidence redaction", () => {
  it("masks 黃生, spaced 師傅, 師傅X仔, and the phone in the evidence block", () => {
    const text = evidenceText(
      reportWithEvidence([
        {
          url: "https://example.com/thread/1",
          title: "黃生介紹陳 師傅",
          snippetExcerpt: "師傅陳仔話 9123 4567",
          matchedToken: "合成",
          matchReason: "entity_token",
        },
      ]),
    );
    expect(text).not.toContain("黃生");
    expect(text).not.toContain("陳 師傅");
    expect(text).not.toContain("陳仔");
    expect(text).not.toContain("9123");
    expect(text).toContain("[姓名]");
    expect(text).toContain("[電話]");
    expect(text).toContain("師傅[姓名]");
  });

  it("keeps a generic trade 師傅 title", () => {
    const text = evidenceText(
      reportWithEvidence([
        {
          url: "https://example.com/thread/2",
          title: "裝修師傅推介",
          snippetExcerpt: "工期準時",
          matchedToken: "合成",
          matchReason: "entity_token",
        },
      ]),
    );
    expect(text).toContain("裝修師傅推介");
    expect(text).toContain("工期準時");
    expect(text).not.toContain("[姓名]");
  });
});