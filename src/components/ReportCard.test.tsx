// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
  MWC_MISS_NOTE_HEADING_ZH,
  UNVERIFIED_COMPANY_REGISTRATION_ALERT_HEADING_ZH,
} from "@/lib/report-trust-copy-zh";
import type { CompaniesRegistryOfficial } from "@/lib/report-schema";
import { summaryZhForLegalLookupDegraded } from "@/lib/search-pipeline-legal-summary";

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

  it("MWC matched + CR matched（無 hint）：唔顯示 CR attribution (L1)", () => {
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
    expect(container.textContent ?? "").not.toContain(CR_DATA_ATTRIBUTION_ZH);
  });

  it("CR degraded：顯示 degraded 文案、冇 alert", () => {
    render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({ lookupStatus: "error" }),
          },
        })}
      />,
    );
    expect(screen.getByText(CR_LOOKUP_DEGRADED_ZH)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("CR ambiguous：0 alert", () => {
    render(
      <ReportCard
        report={minimalReport({
          official: {
            mwcMatched: false,
            companiesRegistry: crRegistry({
              matched: false,
              matchAmbiguous: true,
              hints: [],
            }),
          },
        })}
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
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

  it("legal degraded：唔顯示 C.2c alert", () => {
    const { container } = render(<ReportCard report={degradedReport()} />);
    assertClean(container.textContent ?? "");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(NEXT_STEPS_HEADING_ZH)).toBeTruthy();
    expect(screen.getByText(REPORT_SCOPE_LIMITS_HEADING_ZH)).toBeTruthy();
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
    expect(screen.getByText(LEGAL_EVENT_SOURCE_LINK_LABEL_ZH)).toBeTruthy();
  });
});
