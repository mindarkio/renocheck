import { describe, expect, it } from "vitest";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { RiskReport } from "./report-schema";
import { buildOfficialVerifyLinks } from "./official-verify-links";
import { CR_ESERVICES_URL } from "./report-trust-copy-zh";

function baseReport(overrides: Partial<RiskReport> = {}): RiskReport {
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
    summaryZh: "摘要",
    official: { mwcMatched: false },
    signals: {
      discussionCount: 0,
      themes: [],
      highlights: [],
      retrievalEvidence: [],
      contractChecklist: ["佔位"],
      actionableClauses: [],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-18T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildOfficialVerifyLinks", () => {
  it("includes CR e-services home without query string", () => {
    const links = buildOfficialVerifyLinks(baseReport());
    const icris = links.find((l) => l.id === "icris");
    expect(icris?.url).toBe(CR_ESERVICES_URL);
    expect(icris?.url).toBe("https://www.e-services.cr.gov.hk/");
    expect(links.some((l) => l.id === "bd-discipline")).toBe(false);
  });

  it("uses unique urls per link", () => {
    const urls = buildOfficialVerifyLinks(baseReport()).map((l) => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("uses deep MWC search when license active", () => {
    const evaluation = buildEvaluationStub({
      overallGrade: "B",
      confidence: "high",
      mwcMatched: true,
      boundHitCount: 1,
      highlightCount: 1,
    });
    const report = baseReport({
      evaluation,
      official: {
        mwcMatched: true,
        details: {
          companyName: "合成測試有限公司",
          registrationNo: "MWC12345",
        },
      },
    });
    const bd = buildOfficialVerifyLinks(report).find((l) => l.id === "bd-register");
    expect(bd?.url).toContain("MWC12345");
  });
});
