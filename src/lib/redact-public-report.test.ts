import { describe, expect, it } from "vitest";
import { DISCLAIMER_VERSION, REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { RiskReport } from "./report-schema";
import { riskReportSchema } from "./report-schema";
import { redactReportForPublicResponse } from "./redact-public-report";

/**
 * Synthetic surnames plus honorifics and dummy numbers only.
 * These fixtures live in the test file and are not imported by production code.
 */

const PROSE_KEPT = [
  "根據本次可檢索的公開來源，示例裝修工程有限公司有工期討論。醫生話要休息，事情發生喺完工之後。",
  "裝修師傅推介物料，其他師傅都話工序正常，我覺得師傅好好。",
  "陳記水電工程有限公司同周生生珠寶無關，生意額未見提及，合成測試有限公司則是另一間。",
  "家庭醫生建議暫避，大學生指出合約未寫清保養期。事件發生於去年。",
  "睇醫生同學生會都無關。所有師傅都好。今日師傅冇嚟。",
  "生意好，衛生正常，生活未受影響，學生同醫生都唔關事。",
  "未檢出相關討論",
  "判詞紀錄暫時未能查詢，本次評級未計入判詞。",
  "公開資料有限，未能形成較強信號，建議自行核實牌照與合約。",
];

const PROSE_MASKED: Array<[string, string]> = [
  [
    "有帖提到陳生話尾數未清，問過李師傅，黃太指延期，陳先生話已付款，電話 91234567。",
    "有帖提到[姓名]話尾數未清，問過[姓名]，[姓名]指延期，[姓名]話已付款，電話 [電話]。",
  ],
  ["陳醫生話要病人休息。", "[姓名]話要病人休息。"],
  [
    "聯絡 9123 4567 或 dummy.user@example.com。",
    "聯絡 [電話] 或 [電郵]。",
  ],
  ["Mr Dummy 話已落訂。", "[姓名] 話已落訂。"],
  ["可與陳生確認電話 91234567。", "可與[姓名]確認電話 [電話]。"],
  [
    "詳情見 https://example.com/post/1 提到陳生。",
    "詳情見 [連結] 提到[姓名]。",
  ],
];

type ReportPatch = Omit<Partial<RiskReport>, "signals"> & {
  signals?: Partial<RiskReport["signals"]>;
};

function reportShell(patch: ReportPatch = {}): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "low",
    mwcMatched: true,
    boundHitCount: 1,
    highlightCount: 1,
  });
  const { signals, ...rest } = patch;
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "示例裝修工程有限公司",
      matchType: "company_name",
      queryEcho: "示例裝修工程有限公司",
      searchLabelUsed: "示例裝修工程有限公司",
      nameAlignment: "mwc_authoritative",
    },
    grade: "C",
    confidence: "low",
    evaluation,
    summaryZh: "公開資料有限。",
    official: { mwcMatched: true },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      actionableClauses: [],
      contractChecklist: ["可致電 91234567？"],
      ...signals,
    },
    disclaimerVersion: DISCLAIMER_VERSION,
    generatedAt: "2026-10-24T00:00:00.000Z",
    ...rest,
  };
}

function viaSummary(text: string): string {
  return redactReportForPublicResponse(reportShell({ summaryZh: text })).summaryZh;
}

function viaHighlight(text: string): string {
  const out = redactReportForPublicResponse(
    reportShell({
      signals: {
        highlights: [{ summaryZh: text, url: "https://example.com/h" }],
      },
    }),
  );
  return out.signals.highlights?.[0]?.summaryZh ?? "";
}

describe("LLM prose over-masking", () => {
  it("keeps ordinary Cantonese and written words, generic 師傅, and company names", () => {
    for (const text of PROSE_KEPT) {
      expect(text.length).toBeLessThanOrEqual(120);
      expect(viaSummary(text)).toBe(text);
      expect(viaHighlight(text)).toBe(text);
    }
  });

  it("masks dummy surname honorifics and dummy phones with the existing placeholders", () => {
    for (const [raw, expected] of PROSE_MASKED) {
      expect(raw.length).toBeLessThanOrEqual(120);
      expect(viaSummary(raw)).toBe(expected);
      expect(viaHighlight(raw)).toBe(expected);
    }
  });
});

describe("redactReportForPublicResponse", () => {
  function exampleReport(): RiskReport {
    const hearingQuote = `${"合成判詞摘錄，只供測試。".repeat(45)}陳生電話 91234567。`;
    return reportShell({
      entity: {
        displayName: "陳生",
        matchType: "company_name",
        queryEcho: "陳生",
        searchLabelUsed: "陳生",
        nameAlignment: "mwc_authoritative",
        normalizedPhone: "91234567",
      },
      summaryZh:
        "根據本次可檢索的公開來源，示例裝修工程有限公司有工期討論。醫生話要休息，事情發生喺完工之後。",
      official: {
        mwcMatched: true,
        details: {
          companyName: "陳生",
          registrationNo: "MWC000000",
          authorizedSignatory: "陳生",
          expiryDate: "2099-01-01",
          registryDataAsOf: "2026-10-24T00:00:00.000Z",
        },
        companiesRegistry: {
          lookupStatus: "ok",
          matched: true,
          nameZh: "陳生有限公司",
          nameEn: "Mr Dummy Limited",
          candidateNames: [
            { nameZh: "黃太建築有限公司", nameEn: "Mr Dummy Limited" },
          ],
          retrievedAt: "2026-10-24T00:00:00.000Z",
          hints: [],
          icrisHomeUrl: "https://www.e-services.cr.gov.hk/",
        },
        legalEvents: [
          {
            sourceType: "court_judgment",
            caseRef: "DCCJ 9001/2020",
            court: "District Court",
            eventDate: "2021-03-15",
            judgmentCategory: "renovation_engineering_civil",
            partyRole: "defendant",
            businessForm: "sole_proprietorship",
            defendantDisplayNameZh: "陳生",
            hearingKeyPointsZh: ["陳生作為東主"],
            hearingKeyPointQuotesZh: [hearingQuote],
            sourceUrl: "https://example.com/judgment",
            matchReasonZh: "公司名稱與匯入紀錄一致",
          },
        ],
      },
      signals: {
        discussionCount: 1,
        themes: ["醫生", "學生", "發生", "師傅", "示例裝修工程有限公司", "陳生"],
        highlights: [
          {
            summaryZh: "有帖提到陳生話尾數未清，電話 91234567。",
            url: "https://example.com/h",
            sourceName: "陳生",
            dateHint: "見 91234567",
            factSummary:
              "家庭醫生建議暫避，大學生指出事件發生於去年。裝修師傅推介物料。",
          },
        ],
        retrievalEvidence: [
          {
            url: "https://example.com/e",
            title: "陳生投訴示例裝修工程有限公司",
            snippetExcerpt:
              "問過李師傅，電話 9123 4567。詳情見 https://example.com/post/1",
            matchedToken: "示例裝修工程有限公司",
            matchReason: "entity_token",
          },
        ],
        actionableClauses: [
          {
            category: "付款",
            clauseText: "可與陳生確認。",
            reason: "李師傅未覆",
          },
        ],
        contractChecklist: ["可致電 91234567？"],
        boundHitCount: 1,
        serpHitCount: 1,
      },
      premium: {
        discussionSnippets: [
          {
            title: "陳生投訴",
            url: "https://example.com/p",
            excerpt: "電話 91234567",
          },
        ],
        contractChecklist: ["可致電 91234567？"],
      },
    });
  }

  it("redacts third-party and LLM text and leaves registry identity fields", () => {
    const report = exampleReport();
    const before = structuredClone(report);
    const out = redactReportForPublicResponse(report);

    expect(report).toEqual(before);
    expect(out.official).toBe(report.official);
    expect(out.entity).toBe(report.entity);
    expect(out.evaluation).toBe(report.evaluation);
    expect(out.signals.contractChecklist).toBe(report.signals.contractChecklist);
    expect(out.grade).toBe(report.grade);
    expect(out.reportVersion).toBe(REPORT_VERSION);
    expect(out.disclaimerVersion).toBe(DISCLAIMER_VERSION);

    expect(out.summaryZh).toBe(before.summaryZh);
    expect(out.signals.themes).toEqual([
      "醫生",
      "學生",
      "發生",
      "師傅",
      "示例裝修工程有限公司",
      "[姓名]",
    ]);
    expect(out.signals.highlights?.[0]).toMatchObject({
      summaryZh: "有帖提到[姓名]話尾數未清，電話 [電話]。",
      factSummary:
        "家庭醫生建議暫避，大學生指出事件發生於去年。裝修師傅推介物料。",
      sourceName: "[姓名]",
      dateHint: "見 [電話]",
      url: "https://example.com/h",
    });
    expect(out.signals.retrievalEvidence[0]).toMatchObject({
      url: "https://example.com/e",
      title: "[姓名]投訴示例裝修工程有限公司",
      snippetExcerpt: "問過[姓名]，電話 [電話]。詳情見 [連結]",
      matchedToken: "示例裝修工程有限公司",
    });
    expect(out.signals.actionableClauses[0]).toEqual({
      category: "付款",
      clauseText: "可與[姓名]確認。",
      reason: "[姓名]未覆",
    });
    expect(out.premium?.discussionSnippets[0]).toMatchObject({
      title: "[姓名]投訴",
      url: "https://example.com/p",
      excerpt: "電話 [電話]",
    });
    expect(out.premium?.contractChecklist).toEqual(["可致電 91234567？"]);

    expect(out.entity.displayName).toBe("陳生");
    expect(out.entity.queryEcho).toBe("陳生");
    expect(out.entity.searchLabelUsed).toBe("陳生");
    expect(out.entity.normalizedPhone).toBe("91234567");
    expect(out.official.details?.companyName).toBe("陳生");
    expect(out.official.details?.authorizedSignatory).toBe("陳生");
    expect(out.official.companiesRegistry?.nameZh).toBe("陳生有限公司");
    expect(out.official.companiesRegistry?.nameEn).toBe("Mr Dummy Limited");
    expect(out.official.companiesRegistry?.candidateNames?.[0]?.nameZh).toBe(
      "黃太建築有限公司",
    );
    expect(out.official.legalEvents?.[0]?.defendantDisplayNameZh).toBe("陳生");
    expect(out.official.legalEvents?.[0]?.hearingKeyPointsZh).toEqual([
      "陳生作為東主",
    ]);
    const quote = before.official.legalEvents?.[0]?.hearingKeyPointQuotesZh?.[0];
    expect(quote && quote.length).toBeGreaterThan(500);
    expect(out.official.legalEvents?.[0]?.hearingKeyPointQuotesZh?.[0]).toBe(
      quote,
    );

    expect(riskReportSchema.safeParse(out).success).toBe(true);
    expect(redactReportForPublicResponse(out)).toEqual(out);
  });

  it("clamps a name-dense highlight to the schema max", () => {
    const summaryZh = "陳生".repeat(80);
    const out = redactReportForPublicResponse(
      reportShell({
        signals: {
          highlights: [{ summaryZh, url: "https://example.com/dense" }],
        },
      }),
    );
    expect(out.signals.highlights?.[0]?.summaryZh).toBe("[姓名]".repeat(40));
    expect(out.signals.highlights?.[0]?.summaryZh.length).toBe(160);
  });
});
