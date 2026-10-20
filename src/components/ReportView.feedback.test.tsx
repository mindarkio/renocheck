// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ReportView } from "./ReportView";
import { REPORT_VERSION } from "@/lib/constants";
import { buildEvaluationStub } from "@/lib/evaluation-stub";
import type { RiskReport } from "@/lib/report-schema";
import {
  REPORT_TRUST_FORBIDDEN_ZH,
  REPORT_TRUST_NEGATED_ALLOWLIST_ZH,
} from "@/lib/report-trust-copy-zh";
import * as feedbackCopy from "@/lib/feedback-copy-zh";

const REPORT_TRUST_BANNED_SUBSTRINGS_ZH = [
  "刊憲",
  "數日",
  "小型申索",
  "觸犯",
  "LRS",
  "傢俬",
  "授權前",
  "匿名條數",
] as const;

function assertClean(text: string): void {
  let t = text;
  for (const ok of REPORT_TRUST_NEGATED_ALLOWLIST_ZH) {
    t = t.split(ok).join("");
  }
  for (const w of REPORT_TRUST_FORBIDDEN_ZH) {
    expect(t).not.toContain(w);
  }
  for (const s of REPORT_TRUST_BANNED_SUBSTRINGS_ZH) {
    expect(t).not.toContain(s);
  }
}

const FP = "cd".repeat(16);

function report(): RiskReport {
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
      displayName: "合成測試有限公司",
      matchType: "company_name",
      queryEcho: "合成測試有限公司",
      searchLabelUsed: "合成測試有限公司",
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "low",
    evaluation,
    summaryZh: "公開資料有限，未能形成較強信號，建議自行核實牌照與合約。",
    official: { mwcMatched: false },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      actionableClauses: [],
      contractChecklist: ["有無書面合約？"],
    },
    disclaimerVersion: "1.2.0",
    generatedAt: "2026-10-20T02:00:00.000Z",
  };
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("ReportView feedback flag", () => {
  it("renders no feedback UI when the flag is off", async () => {
    sessionStorage.setItem(`renocheck:report:${FP}`, JSON.stringify(report()));
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(
      async () => new Response(null, { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ReportView fingerprint={FP} />);

    await waitFor(() => {
      expect(screen.getByText("合成測試有限公司")).toBeTruthy();
    });
    expect(screen.queryByText("呢份報告有冇幫到你？")).toBeNull();
    expect(document.querySelector("[data-feedback-inline]")).toBeNull();
    expect(document.querySelector("[data-feedback-sentinel]")).toBeNull();
    expect(document.getElementById("report-new-search")).toBeNull();
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/feedback")),
    ).toBe(false);
    assertClean(document.body.textContent ?? "");
  });

  it("places feedback between the report and the new-search link when enabled", async () => {
    sessionStorage.setItem(`renocheck:report:${FP}`, JSON.stringify(report()));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );

    const { container } = render(
      <ReportView fingerprint={FP} feedbackEnabled />,
    );

    await waitFor(() => {
      expect(screen.getByText("呢份報告有冇幫到你？")).toBeTruthy();
    });
    const name = screen.getByText("合成測試有限公司");
    const feedback = document.querySelector("[data-feedback-inline]");
    const cta = screen.getByRole("link", { name: /新搜尋/ });
    expect(feedback).toBeTruthy();
    expect(
      name.compareDocumentPosition(feedback as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      (feedback as Node).compareDocumentPosition(cta) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(document.getElementById("report-new-search")).toBeTruthy();
    assertClean(container.textContent ?? "");
    assertClean(
      Object.values(feedbackCopy)
        .filter((value) => typeof value === "string")
        .join("\n"),
    );
  });
});
