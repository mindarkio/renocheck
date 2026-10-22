// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReportCard } from "./ReportCard";
import { REPORT_VERSION } from "@/lib/constants";
import { buildEvaluationStub } from "@/lib/evaluation-stub";
import type { RiskReport } from "@/lib/report-schema";
import { LEGAL_LOOKUP_DEGRADED_SECTION_ZH } from "@/lib/legal-event-display";
import {
  DEFAULT_CONTRACT_CHECKLIST_ZH,
  LEGAL_EVENT_SOURCE_LINK_LABEL_ZH,
  NEXT_STEPS_HEADING_ZH,
  NON_LIMITED_NOTICE_HEADING_ZH,
  REPORT_SCOPE_LIMITS_HEADING_ZH,
  REPORT_TRUST_FORBIDDEN_ZH,
  REPORT_TRUST_NEGATED_ALLOWLIST_ZH,
  CR_DATA_ATTRIBUTION_ZH,
  CR_ESERVICES_URL,
  CR_LOOKUP_DEGRADED_ZH,
  MWC_MISS_FALLBACK_BODY_PARAGRAPHS_ZH,
  MWC_MISS_FALLBACK_CR_INCONCLUSIVE_ZH,
  MWC_MISS_NOTE_CR_SIMILAR_ZH,
  MWC_MISS_NOTE_HEADING_ZH,
  UNVERIFIED_COMPANY_REGISTRATION_ALERT_HEADING_ZH,
  COPY_COMPANY_NAME_BUTTON_ZH,
  DAILY_CAUSE_LIST_LINK_LABEL_ZH,
  ICRIS_SELF_SERVICE_NOTE_ZH,
  OFFICIAL_VERIFY_SECTION_HEADING_ZH,
  ORO_SELF_SERVICE_NOTE_ZH,
} from "@/lib/report-trust-copy-zh";
import type { CompaniesRegistryOfficial } from "@/lib/report-schema";
import { summaryZhForLegalLookupDegraded } from "@/lib/search-pipeline-legal-summary";
import { applyRiskBandMaxCapToReport } from "@/lib/risk-band-calibration";
import { riskBandRationaleLineZh } from "@/lib/report-risk-band-rationale";

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

afterEach(() => {
  cleanup();
  delete process.env.RISK_BAND_MAX;
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

function crRegistry(
  overrides: Partial<CompaniesRegistryOfficial> = {},
): CompaniesRegistryOfficial {
  return {
    lookupStatus: "ok",
    retrievedAt: "2026-10-18T12:00:00.000Z",
    hints: ["not_found_in_active_list"],
    matched: false,
    icrisHomeUrl: CR_ESERVICES_URL,
    ...overrides,
  };
}

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
    official: {
      mwcMatched: false,
      legalLookupStatus: "ok",
      companiesRegistry: crRegistry(),
    },
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

describe("ReportCard legal lookup degraded", () => {
  it("shows 中性 in hero and hides 未見負面摘要 footer", () => {
    const report = degradedReport();
    render(<ReportCard report={report} />);
    expect(screen.getByText("中性", { selector: "p" })).toBeTruthy();
    expect(screen.queryByText(/「未見負面摘要」僅表示/)).toBeNull();
    expect(screen.getByText(LEGAL_LOOKUP_DEGRADED_SECTION_ZH)).toBeTruthy();
    expect(
      screen.queryByText(UNVERIFIED_COMPANY_REGISTRATION_ALERT_HEADING_ZH),
    ).toBeNull();
  });
});

describe("ReportCard report trust (PR-BC)", () => {
  it("CR not_found + MWC miss：alert、attribution、六條簽約提問", () => {
    const { container } = render(<ReportCard report={minimalReport()} />);
    assertClean(container.textContent ?? "");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(
      UNVERIFIED_COMPANY_REGISTRATION_ALERT_HEADING_ZH,
    );
    expect(alert.textContent).toContain(CR_DATA_ATTRIBUTION_ZH);
    for (const q of DEFAULT_CONTRACT_CHECKLIST_ZH) {
      expect(screen.getByText(q)).toBeTruthy();
    }
  });

  it("CR matched + MWC miss：0 alert、MWC note + attribution", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({ matched: true, hints: [] }),
          },
        })}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(MWC_MISS_NOTE_HEADING_ZH)).toBeTruthy();
    expect(screen.getByRole("note")).toBeTruthy();
    expect(container.textContent).toContain(CR_DATA_ATTRIBUTION_ZH);
  });

  it("MWC matched + CR matched（無 hint）：身份卡顯示 CR attribution", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: true,
            companiesRegistry: crRegistry({ matched: true, hints: [] }),
          },
        })}
      />,
    );
    expect(container.textContent ?? "").toContain(CR_DATA_ATTRIBUTION_ZH);
    expect(container.textContent).toContain("公司身份（公司註冊處）");
  });

  it("CR degraded：顯示 degraded 文案、冇 alert", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({ lookupStatus: "error" }),
          },
        })}
      />,
    );
    expect(screen.getAllByText(CR_LOOKUP_DEGRADED_ZH)).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      container.querySelectorAll(`a[href="${CR_ESERVICES_URL}"]`),
    ).toHaveLength(1);
  });

  it("CR timeout：degraded + fallback note（L-c）", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            legalLookupStatus: "ok",
            companiesRegistry: crRegistry({ lookupStatus: "timeout" }),
          },
        })}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(screen.getAllByText(CR_LOOKUP_DEGRADED_ZH)).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(MWC_MISS_NOTE_HEADING_ZH)).toBeTruthy();
    expect(
      screen.getByText(MWC_MISS_FALLBACK_BODY_PARAGRAPHS_ZH[1]),
    ).toBeTruthy();
    expect(
      screen.queryByText(MWC_MISS_FALLBACK_CR_INCONCLUSIVE_ZH),
    ).toBeNull();
  });

  it("tier C match shows MWC_MISS_NOTE_CR_SIMILAR_ZH (L-T)", () => {
    render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({
              matched: true,
              matchTier: "C",
              hints: [],
            }),
          },
        })}
      />,
    );
    expect(screen.getByText(MWC_MISS_NOTE_CR_SIMILAR_ZH)).toBeTruthy();
  });

  it("CR ambiguous + MWC miss：inconclusive fallback copy（c-L1）", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({
              lookupStatus: "ok",
              matched: false,
              matchAmbiguous: true,
              hints: [],
            }),
          },
        })}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(MWC_MISS_FALLBACK_CR_INCONCLUSIVE_ZH)).toBeTruthy();
    expect(
      screen.queryByText(MWC_MISS_FALLBACK_BODY_PARAGRAPHS_ZH[1]),
    ).toBeNull();
  });

  it("CR skipped（phone）：fallback 用原句（c-L1）", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          entity: {
            displayName: "91234567",
            matchType: "phone",
            queryEcho: "91234567",
            searchLabelUsed: "91234567",
            nameAlignment: "user_only",
          },
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({
              lookupStatus: "skipped",
              hints: [],
            }),
          },
        })}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(
      screen.getByText(MWC_MISS_FALLBACK_BODY_PARAGRAPHS_ZH[1]),
    ).toBeTruthy();
    expect(
      screen.queryByText(MWC_MISS_FALLBACK_CR_INCONCLUSIVE_ZH),
    ).toBeNull();
  });

  it("非有限公司：note 非 alert", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          entity: {
            displayName: "合成裝修工程",
            matchType: "company_name",
            queryEcho: "合成裝修工程",
            searchLabelUsed: "合成裝修工程",
            nameAlignment: "user_only",
          },
          official: {
            mwcMatched: false,
            companiesRegistry: {
              lookupStatus: "skipped",
              retrievedAt: "2026-10-18T12:00:00.000Z",
              hints: [],
              icrisHomeUrl: CR_ESERVICES_URL,
            },
          },
        })}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("note")).toBeTruthy();
    expect(screen.getByText(NON_LIMITED_NOTICE_HEADING_ZH)).toBeTruthy();
  });

  it("審訊案件表 POST 表單（A5）", () => {
    const { container } = render(<ReportCard report={minimalReport()} />);
    assertClean(container.textContent ?? "");
    const forms = container.querySelectorAll(
      'form[method="post"][action="https://e-services.judiciary.hk/dcl/search.jsp"][target="_blank"]',
    );
    expect(forms.length).toBeGreaterThanOrEqual(1);
    const form = forms[0]!;
    expect(form.getAttribute("rel")).toContain("noopener");
    for (const name of ["lang", "date", "mode", "parties"]) {
      expect(
        form.querySelector(`input[type="hidden"][name="${name}"]`),
      ).toBeTruthy();
    }
    const date = form.querySelector<HTMLInputElement>('input[name="date"]')!;
    fireEvent.submit(form);
    expect(date.value).toMatch(/^\d{8}$/);
  });

  it("legal degraded：唔顯示 C.2c alert", () => {
    const { container } = render(<ReportCard report={degradedReport()} />);
    assertClean(container.textContent ?? "");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(NEXT_STEPS_HEADING_ZH)).toBeTruthy();
    expect(screen.getByText(REPORT_SCOPE_LIMITS_HEADING_ZH)).toBeTruthy();
  });

  it("employment_renovation：案號、類別、裁定與去重後宗數", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            legalLookupStatus: "ok",
            legalEvents: [
              {
                sourceType: "court_judgment",
                caseRef: "HCLA901/2024",
                relatedCaseRefs: ["HCLA903/2024"],
                neutralCitation: "[2025] HKCFI 9901",
                court: "高院",
                eventDate: "2025-02-10",
                partyRole: "defendant",
                judgmentCategory: "employment_renovation",
                outcomeHint: "defendant_liable",
                sourceUrl:
                  "https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=1&TP=JU",
                matchReasonZh: "合成",
                hearingKeyPointsZh: ["合成勞資要點"],
              },
            ],
          },
        })}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(container.textContent).toContain("HCLA901/2024");
    expect(container.textContent).toContain("HCLA903/2024");
    expect(container.textContent).toContain("勞資糾紛（裝修工程相關）");
    expect(container.textContent).toContain("裁定須負責");
    expect(container.textContent).toContain("公開判詞紀錄（1 宗）");
    const panel = container.querySelector("[data-testid=legal-events-panel]");
    expect(panel?.className).toContain("w-full");
    expect(panel?.className).not.toContain("lg:max-w-none");
  });

  it("有 legalEvents：唔顯示 C.2c alert", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            legalLookupStatus: "ok",
            legalEvents: [
              {
                sourceType: "court_judgment",
                caseRef: "SYNTH/1/2024",
                court: "高院",
                eventDate: "2024-01-01",
                partyRole: "defendant",
                judgmentCategory: "other_civil",
                sourceUrl: "https://example.com/j",
                matchReasonZh: "合成",
                hearingKeyPointsZh: ["合成事實"],
              },
            ],
          },
        })}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText(LEGAL_EVENT_SOURCE_LINK_LABEL_ZH)[0]).toBeTruthy();
  });

  it("官方來源：ICRIS note、ORO 收費註；唔含百樓圖網；喺報告限制之後", () => {
    const { container } = render(<ReportCard report={minimalReport()} />);
    assertClean(container.textContent ?? "");
    expect(container.textContent).toContain(OFFICIAL_VERIFY_SECTION_HEADING_ZH);
    expect(container.textContent).not.toContain("官方查證連結");
    expect(container.textContent).toContain(ICRIS_SELF_SERVICE_NOTE_ZH);
    expect(container.textContent).toContain(ORO_SELF_SERVICE_NOTE_ZH);
    expect(container.textContent).not.toContain("百樓圖網");
    const limitsIdx = container.textContent!.indexOf(
      REPORT_SCOPE_LIMITS_HEADING_ZH,
    );
    const officialIdx = container.textContent!.indexOf(
      OFFICIAL_VERIFY_SECTION_HEADING_ZH,
    );
    expect(limitsIdx).toBeGreaterThan(-1);
    expect(officialIdx).toBeGreaterThan(limitsIdx);
  });

  it("審訊案件表掣只得一個", () => {
    render(<ReportCard report={minimalReport()} />);
    expect(
      screen.getAllByText(DAILY_CAUSE_LIST_LINK_LABEL_ZH),
    ).toHaveLength(1);
  });

  it("matched CR：身份卡喺 header 之後、複製掣在卡內", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({
              matched: true,
              nameZh: "合成測試有限公司",
            }),
          },
        })}
      />,
    );
    const header = container.querySelector("header");
    const identity = screen.getByText("公司身份（公司註冊處）");
    expect(header).toBeTruthy();
    expect(
      header!.compareDocumentPosition(identity) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText(COPY_COMPANY_NAME_BUTTON_ZH)).toBeTruthy();
  });

  it("CR matched 有 brNo：顯示核對文案", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({
              matched: true,
              brNo: "C1111111",
              nameZh: "合成測試有限公司",
            }),
          },
        })}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(container.textContent).toContain("C1111111");
    expect(container.textContent).toContain("商業登記證核對");
  });

  it("CR matched 無 brNo：唔顯示商業登記號碼為", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({ matched: true }),
          },
        })}
      />,
    );
    expect(container.textContent).not.toContain("商業登記號碼為");
  });

  it("CR 未 matched：唔顯示 brNo 文案", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({
              matched: false,
              brNo: "C1111111",
            }),
          },
        })}
      />,
    );
    expect(container.textContent).not.toContain("C1111111");
    expect(container.textContent).not.toContain("商業登記號碼為");
  });

  it("PRU-A1：淨判詞升高分檔 — 公開討論未檢出 + 公開判詞 chip，唔出近期糾紛提及", () => {
    const evaluation = buildEvaluationStub({
      overallGrade: "C",
      confidence: "medium",
      mwcMatched: false,
      boundHitCount: 0,
      highlightCount: 0,
    });
    const { container } = render(
      <ReportCard
        report={minimalReport({
          summaryZh:
            "未檢出相關的裝修糾紛或投訴討論摘要（不包括判詞紀錄）。",
          evaluation: {
            ...evaluation,
            riskBandZh: "風險中等",
            reputationTrack: {
              disputeLevel: "active_concerning",
              recentDisputeCount: 0,
            },
          },
          official: {
            mwcMatched: false,
            legalLookupStatus: "ok",
            legalEvents: [
              {
                sourceType: "court_judgment",
                caseRef: "HCLA 99/2024",
                court: "高院",
                eventDate: "2025-01-01",
                judgmentCategory: "employment_renovation",
                partyRole: "defendant",
                outcomeHint: "defendant_liable",
                hearingKeyPointsZh: ["合成勞資要點"],
                sourceUrl: "https://example.com/judgment",
                matchReasonZh: "合成匹配",
              },
            ],
          },
          signals: {
            discussionCount: 0,
            themes: [],
            highlights: [],
            retrievalEvidence: [],
            contractChecklist: ["佔位"],
            actionableClauses: [],
            boundHitCount: 0,
          },
        })}
      />,
    );
    const header = container.querySelector("header");
    assertClean(header?.textContent ?? "");
    expect(screen.getByText("公開討論：未檢出")).toBeTruthy();
    expect(screen.getByText("公開判詞 · 1 宗")).toBeTruthy();
    expect(container.textContent).not.toContain("近期糾紛提及");
    const legalChip = screen.getByText("公開判詞 · 1 宗").closest("span");
    expect(legalChip?.className).toContain("amber");
    const forumChip = screen.getByText("公開討論：未檢出").closest("span");
    expect(forumChip?.className).not.toContain("amber");
  });

  it("hero chip 顏色：兩樣都冇（兩粒灰）", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            legalLookupStatus: "ok",
            legalEvents: [],
            companiesRegistry: crRegistry(),
          },
        })}
      />,
    );
    const header = container.querySelector("header");
    assertClean(header?.textContent ?? "");
    const forum = screen.getByText("公開討論：未檢出").closest("span");
    const legal = screen.getByText("判詞庫未對照").closest("span");
    expect(forum?.className).not.toContain("amber");
    expect(legal?.className).not.toContain("amber");
  });

  it("hero chip 顏色：淨討論區（討論區琥珀、判詞庫未對照灰）", () => {
    const evaluation = buildEvaluationStub({
      overallGrade: "C",
      confidence: "medium",
      mwcMatched: false,
      boundHitCount: 2,
      highlightCount: 1,
    });
    const { container } = render(
      <ReportCard
        report={minimalReport({
          evaluation: {
            ...evaluation,
            reputationTrack: {
              disputeLevel: "active_concerning",
              recentDisputeCount: 1,
            },
          },
          signals: {
            discussionCount: 1,
            themes: [],
            highlights: [
              { summaryZh: "合成提及", url: "https://example.com/x" },
            ],
            retrievalEvidence: [],
            contractChecklist: ["佔位"],
            actionableClauses: [],
            boundHitCount: 2,
          },
          official: {
            mwcMatched: false,
            legalLookupStatus: "ok",
            legalEvents: [],
          },
        })}
      />,
    );
    const header = container.querySelector("header");
    assertClean(header?.textContent ?? "");
    expect(screen.getByText("近期糾紛提及 · 1 則").closest("span")?.className).toContain(
      "amber",
    );
    expect(screen.getByText("判詞庫未對照").closest("span")?.className).not.toContain(
      "amber",
    );
  });

  it("hero chip 顏色：兩樣都有（兩粒可一齊琥珀）", () => {
    const evaluation = buildEvaluationStub({
      overallGrade: "C",
      confidence: "medium",
      mwcMatched: false,
      boundHitCount: 1,
      highlightCount: 1,
    });
    const { container } = render(
      <ReportCard
        report={minimalReport({
          evaluation: {
            ...evaluation,
            riskBandZh: "風險中等",
            reputationTrack: {
              disputeLevel: "active_concerning",
              recentDisputeCount: 1,
            },
          },
          signals: {
            discussionCount: 1,
            themes: [],
            highlights: [
              { summaryZh: "合成提及", url: "https://example.com/x" },
            ],
            retrievalEvidence: [],
            contractChecklist: ["佔位"],
            actionableClauses: [],
            boundHitCount: 1,
          },
          official: {
            mwcMatched: false,
            legalLookupStatus: "ok",
            legalEvents: [
              {
                sourceType: "court_judgment",
                caseRef: "HCLA 1/2024",
                court: "高院",
                eventDate: "2024-06-01",
                judgmentCategory: "employment_renovation",
                partyRole: "defendant",
                outcomeHint: "defendant_liable",
                hearingKeyPointsZh: ["合成"],
                sourceUrl: "https://example.com/j",
                matchReasonZh: "合成",
              },
            ],
          },
        })}
      />,
    );
    const header = container.querySelector("header");
    assertClean(header?.textContent ?? "");
    expect(screen.getByText("近期糾紛提及 · 1 則").closest("span")?.className).toContain(
      "amber",
    );
    expect(screen.getByText("公開判詞 · 1 宗").closest("span")?.className).toContain(
      "amber",
    );
  });

  it("依據 line: exact copy, N, link; hidden when N=0", () => {
    const threeDisputeReport = minimalReport({
      generatedAt: "2026-06-01T00:00:00.000Z",
      evaluation: {
        ...buildEvaluationStub({
          overallGrade: "D",
          confidence: "high",
          mwcMatched: false,
          boundHitCount: 3,
          highlightCount: 3,
        }),
        riskBandZh: "風險偏高",
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 3,
        },
      },
      signals: {
        discussionCount: 3,
        themes: [],
        boundHitCount: 3,
        contractChecklist: ["佔位"],
        actionableClauses: [],
        retrievalEvidence: [],
        highlights: [
          {
            summaryZh: "走數苦主帖一",
            url: "https://www.facebook.com/a",
            incidentType: "payment_dispute",
            approxYear: "2025",
          },
          {
            summaryZh: "走數苦主帖二",
            url: "https://www.lihkg.com/b",
            incidentType: "payment_dispute",
            approxYear: "2025",
          },
          {
            summaryZh: "走數苦主帖三",
            url: "https://www.threads.net/c",
            incidentType: "payment_dispute",
            approxYear: "2025",
          },
        ],
      },
    });
    const { container } = render(<ReportCard report={threeDisputeReport} />);
    const a = container.querySelector("a[href='#highlights-heading']");
    expect(a?.textContent).toBe(riskBandRationaleLineZh(3));
    expect(container.querySelector("#highlights-heading")).toBeTruthy();
    assertClean(container.querySelector("header")?.textContent ?? "");
    cleanup();
    const praiseOnlyReport = minimalReport({
      evaluation: {
        ...minimalReport().evaluation,
        riskBandZh: "未見負面摘要",
        reputationTrack: { disputeLevel: "none_detected", recentDisputeCount: 0 },
      },
      signals: {
        ...minimalReport().signals,
        boundHitCount: 2,
        highlights: [
          {
            summaryZh: "好評",
            url: "https://www.facebook.com/p",
            incidentType: "communication",
          },
        ],
      },
    });
    const { container: c2 } = render(<ReportCard report={praiseOnlyReport} />);
    expect(c2.textContent).not.toContain("依據：");
  });

  it("依據 line hidden when N>0 but band is 中性", () => {
    const report = minimalReport({
      generatedAt: "2026-06-01T00:00:00.000Z",
      evaluation: {
        ...buildEvaluationStub({
          overallGrade: "D",
          confidence: "high",
          mwcMatched: false,
          boundHitCount: 3,
          highlightCount: 3,
        }),
        riskBandZh: "中性",
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 3,
        },
      },
      signals: {
        discussionCount: 3,
        themes: [],
        boundHitCount: 3,
        contractChecklist: ["佔位"],
        actionableClauses: [],
        retrievalEvidence: [],
        highlights: [
          {
            summaryZh: "走數苦主帖一",
            url: "https://www.facebook.com/a",
            incidentType: "payment_dispute",
            approxYear: "2025",
          },
          {
            summaryZh: "走數苦主帖二",
            url: "https://www.lihkg.com/b",
            incidentType: "payment_dispute",
            approxYear: "2025",
          },
          {
            summaryZh: "走數苦主帖三",
            url: "https://www.threads.net/c",
            incidentType: "payment_dispute",
            approxYear: "2025",
          },
        ],
      },
    });
    const { container } = render(<ReportCard report={report} />);
    expect(container.textContent).not.toContain("依據：");
  });

  it("bound links render with highlights; no raw URL text", () => {
    const withHighlightsAndEvidence = minimalReport({
      signals: {
        discussionCount: 1,
        themes: [],
        boundHitCount: 1,
        contractChecklist: ["佔位"],
        actionableClauses: [],
        highlights: [
          {
            summaryZh: "討論",
            url: "https://www.lihkg.com/thread/1",
            incidentType: "other",
          },
        ],
        retrievalEvidence: [
          {
            url: "https://www.facebook.com/groups/secret-path-12345",
            title: "",
            snippetExcerpt: "https://www.facebook.com/leak",
            matchedToken: "陳師傅",
            matchReason: "entity_token",
          },
        ],
      },
    });
    const { container } = render(
      <ReportCard report={withHighlightsAndEvidence} />,
    );
    expect(container.querySelector("#retrieval-evidence-heading")).toBeTruthy();
    expect(container.textContent).not.toMatch(/https?:\/\//);
    expect(container.textContent).toContain("facebook.com");
  });

  it("bound links redact title and snippet when no highlights", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          signals: {
            ...minimalReport().signals,
            boundHitCount: 1,
            highlights: [],
            retrievalEvidence: [
              {
                url: "https://www.facebook.com/groups/x",
                title: "陳師傅推介",
                snippetExcerpt: "致電 9123 4567 搵陳師傅",
                matchedToken: "陳師傅",
                matchReason: "entity_token",
              },
            ],
          },
        })}
      />,
    );
    expect(container.querySelector("#retrieval-evidence-heading")).toBeTruthy();
    const evidenceBlock = container
      .querySelector("#retrieval-evidence-heading")
      ?.closest("section");
    const text = evidenceBlock?.textContent ?? "";
    expect(text).not.toMatch(/師傅|9123/);
    expect(text).toContain("[姓名]");
  });

  it("RISK_BAND_MAX=中性 with judgment floor shows 風險中等 and no 依據 line", () => {
    process.env.RISK_BAND_MAX = "中性";
    let report = minimalReport({
      generatedAt: "2026-06-01T00:00:00.000Z",
      evaluation: {
        ...minimalReport().evaluation,
        riskBandZh: "風險偏高",
        reputationTrack: {
          disputeLevel: "active_concerning",
          recentDisputeCount: 0,
        },
      },
      signals: {
        ...minimalReport().signals,
        boundHitCount: 1,
        highlights: [],
      },
      official: {
        mwcMatched: false,
        legalLookupStatus: "ok",
        legalEvents: [
          {
            sourceType: "court_judgment",
            caseRef: "HCLA 1/2024",
            court: "高院",
            eventDate: "2024-06-01",
            judgmentCategory: "employment_renovation",
            partyRole: "defendant",
            outcomeHint: "defendant_liable",
            hearingKeyPointsZh: ["合成"],
            sourceUrl: "https://example.com/j",
            matchReasonZh: "合成",
          },
        ],
      },
    });
    report = applyRiskBandMaxCapToReport(report);
    const { container } = render(<ReportCard report={report} />);
    expect(container.textContent).toContain("風險中等");
    expect(container.textContent).not.toContain("依據：");
  });

  it("legal scope 關：冇判詞 chip", () => {
    const { container } = render(
      <ReportCard
        report={minimalReport({
          official: { mwcMatched: false },
        })}
      />,
    );
    const header = container.querySelector("header");
    assertClean(header?.textContent ?? "");
    expect(screen.queryByText("判詞庫未對照")).toBeNull();
    expect(container.textContent ?? "").not.toMatch(/公開判詞 ·/);
  });
});
