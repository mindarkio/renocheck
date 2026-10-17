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
});
