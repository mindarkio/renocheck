import { describe, expect, it, vi } from "vitest";
import { REPORT_VERSION } from "@/lib/constants";
import { buildEvaluationStub } from "@/lib/evaluation-stub";
import type { RiskReport } from "@/lib/report-schema";

const getCachedReport = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({}),
}));
vi.mock("@/lib/search-cache", () => ({
  getCachedReport: (...args: unknown[]) => getCachedReport(...args),
}));

import { GET } from "./route";

function degradedReport(): RiskReport {
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
      displayName: "示例公司",
      matchType: "company_name",
      queryEcho: "示例公司",
      searchLabelUsed: "示例公司",
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "low",
    evaluation,
    summaryZh: "判詞紀錄暫時未能查詢，本次評級未計入判詞。",
    official: { mwcMatched: false, legalLookupStatus: "error" },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      actionableClauses: [],
      contractChecklist: ["有無書面合約？"],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-17T12:00:00.000Z",
  };
}

describe("GET /api/report/[fingerprint]", () => {
  it("returns degraded cached report for share links", async () => {
    const report = degradedReport();
    getCachedReport.mockResolvedValue(report);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ fingerprint: "a".repeat(32) }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { report: RiskReport };
    expect(body.report.official.legalLookupStatus).toBe("error");
  });

  it("redacts cached third-party text without rewriting the stored report", async () => {
    const report = degradedReport();
    report.summaryZh = "陳生話尾數未清，電話 91234567。";
    report.entity.displayName = "陳生";
    report.official = {
      mwcMatched: true,
      legalLookupStatus: "error",
      details: { companyName: "陳生", authorizedSignatory: "陳生" },
    };
    report.signals.themes = ["學生", "陳生"];
    report.signals.retrievalEvidence = [
      {
        url: "https://example.com/e",
        title: "李師傅未覆",
        snippetExcerpt: "電話 91234567",
        matchedToken: "91234567",
        matchReason: "phone_anchor",
      },
    ];
    getCachedReport.mockResolvedValue(report);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ fingerprint: "b".repeat(32) }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { report: RiskReport };
    expect(report.summaryZh).toBe("陳生話尾數未清，電話 91234567。");
    expect(body.report.summaryZh).toBe("[姓名]話尾數未清，電話 [電話]。");
    expect(body.report.signals.themes).toEqual(["學生", "[姓名]"]);
    expect(body.report.signals.retrievalEvidence[0]?.title).toBe("[姓名]未覆");
    expect(body.report.signals.retrievalEvidence[0]?.snippetExcerpt).toBe(
      "電話 [電話]",
    );
    expect(body.report.signals.retrievalEvidence[0]?.matchedToken).toBe(
      "[電話]",
    );
    expect(body.report.entity.displayName).toBe("陳生");
    expect(body.report.official.details?.authorizedSignatory).toBe("陳生");
    expect(body.report.official.details?.companyName).toBe("陳生");
    expect(body.report.signals.contractChecklist).toEqual(["有無書面合約？"]);
  });
});
