import { describe, expect, it } from "vitest";
import { riskReportSchema } from "./report-schema";
import { normalizeIsoDatetimeForSchema } from "./normalize-iso-datetime";
import { buildEvaluationStub } from "./evaluation-stub";
import { REPORT_VERSION } from "./constants";

describe("normalizeIsoDatetimeForSchema", () => {
  it("converts Postgres timestamptz to Zod-safe ISO", () => {
    const raw = "2026-10-16T09:52:18.516274+00:00";
    const out = normalizeIsoDatetimeForSchema(raw);
    expect(out).toMatch(/Z$/);
    expect(riskReportSchema.safeParse({
      reportVersion: REPORT_VERSION,
      entity: {
        displayName: "x",
        matchType: "company_name",
        queryEcho: "x",
        searchLabelUsed: "x",
        nameAlignment: "user_only",
      },
      grade: "C",
      confidence: "low",
      evaluation: buildEvaluationStub({
        overallGrade: "C",
        confidence: "low",
        mwcMatched: false,
        boundHitCount: 0,
        highlightCount: 0,
      }),
      summaryZh: "測",
      official: {
        mwcMatched: false,
        legalRegistryAsOf: out,
      },
      signals: {
        discussionCount: 0,
        themes: [],
        retrievalEvidence: [],
        contractChecklist: ["?"],
        actionableClauses: [],
      },
      disclaimerVersion: "1.0.0",
      generatedAt: new Date().toISOString(),
    }).success).toBe(true);
  });
});
