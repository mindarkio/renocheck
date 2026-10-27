// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReportCard } from "./ReportCard";
import { REPORT_VERSION } from "@/lib/constants";
import { buildEvaluationStub } from "@/lib/evaluation-stub";
import type { RiskReport } from "@/lib/report-schema";

function report(partial: {
  displayName: string;
  queryEcho: string;
  matchType?: RiskReport["entity"]["matchType"];
  mwcMatched: boolean;
  ambiguous?: boolean;
}): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "low",
    mwcMatched: partial.mwcMatched,
    mwcAmbiguous: partial.ambiguous ?? false,
    boundHitCount: 0,
    highlightCount: 0,
  });
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: partial.displayName,
      matchType: partial.matchType ?? "company_name",
      queryEcho: partial.queryEcho,
      searchLabelUsed: partial.displayName,
      nameAlignment: partial.mwcMatched ? "mwc_authoritative" : "user_only",
    },
    grade: "C",
    confidence: "low",
    evaluation,
    summaryZh: "公開資料摘要。",
    official: {
      mwcMatched: partial.mwcMatched,
      legalLookupStatus: "ok",
      ...(partial.mwcMatched
        ? {
            details: {
              companyName: partial.displayName,
              registrationNo: "MWC 10/2026",
            },
          }
        : {}),
    },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      contractChecklist: ["佔位"],
      actionableClauses: [],
    },
    disclaimerVersion: "1.2.6",
    generatedAt: "2026-10-26T00:00:00.000Z",
  };
}

afterEach(() => {
  cleanup();
});

describe("ReportCard verification scope", () => {
  it("shows 本次查證範圍 when the typed name and the register name differ", () => {
    render(
      <ReportCard
        report={report({
          displayName: "合成設計有限公司",
          queryEcho: "合成設計",
          mwcMatched: true,
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: "本次查證範圍" })).toBeTruthy();
    expect(screen.getByText("你輸入「合成設計」／名冊名稱「合成設計有限公司」")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("合成設計有限公司");
  });

  it("hides the line when the names match or the register missed", () => {
    const { unmount } = render(
      <ReportCard
        report={report({
          displayName: "合成設計有限公司",
          queryEcho: "合成　設計有限公司",
          mwcMatched: true,
        })}
      />,
    );
    expect(screen.queryByRole("heading", { name: "本次查證範圍" })).toBeNull();
    unmount();
    render(
      <ReportCard
        report={report({
          displayName: "合成設計",
          queryEcho: "合成設計",
          mwcMatched: false,
        })}
      />,
    );
    expect(screen.queryByText("本次查證範圍")).toBeNull();
  });

  it("shows the line for phone and BR headings that became a register name", () => {
    const { unmount } = render(
      <ReportCard
        report={report({
          displayName: "合成設計有限公司",
          queryEcho: "91234567",
          matchType: "phone",
          mwcMatched: true,
        })}
      />,
    );
    expect(screen.getByText("你輸入「91234567」／名冊名稱「合成設計有限公司」")).toBeTruthy();
    unmount();
    render(
      <ReportCard
        report={report({
          displayName: "合成設計有限公司",
          queryEcho: "12345678",
          matchType: "br",
          mwcMatched: true,
        })}
      />,
    );
    expect(screen.getByText("你輸入「12345678」／名冊名稱「合成設計有限公司」")).toBeTruthy();
  });

  it("shows only the phone or BR when other text was sent with it", () => {
    const { unmount } = render(
      <ReportCard
        report={report({
          displayName: "合成設計有限公司",
          queryEcho: "合成任意文字 · 91234567",
          matchType: "phone",
          mwcMatched: true,
        })}
      />,
    );
    expect(screen.getByText("你輸入「91234567」／名冊名稱「合成設計有限公司」")).toBeTruthy();
    expect(document.body.textContent).not.toContain("合成任意文字");
    unmount();
    render(
      <ReportCard
        report={report({
          displayName: "合成設計有限公司",
          queryEcho: "合成任意文字 · 12345678",
          matchType: "br",
          mwcMatched: true,
        })}
      />,
    );
    expect(screen.getByText("你輸入「12345678」／名冊名稱「合成設計有限公司」")).toBeTruthy();
    expect(document.body.textContent).not.toContain("合成任意文字");
  });

  it("uses 政府名冊有登記 after an unambiguous pick and 需再核實 when still ambiguous", () => {
    const { unmount } = render(
      <ReportCard
        report={report({
          displayName: "合成設計有限公司",
          queryEcho: "合成設計",
          mwcMatched: true,
          ambiguous: false,
        })}
      />,
    );
    expect(screen.getByText("政府名冊有登記")).toBeTruthy();
    expect(screen.queryByText("政府名冊需再核實")).toBeNull();
    unmount();
    render(
      <ReportCard
        report={report({
          displayName: "合成設計有限公司",
          queryEcho: "合成設計",
          mwcMatched: true,
          ambiguous: true,
        })}
      />,
    );
    expect(screen.getByText("政府名冊需再核實")).toBeTruthy();
  });
});
