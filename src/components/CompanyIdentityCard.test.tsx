// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CompanyIdentityCard } from "./CompanyIdentityCard";
import { REPORT_VERSION } from "@/lib/constants";
import { buildEvaluationStub } from "@/lib/evaluation-stub";
import type { CompaniesRegistryOfficial, RiskReport } from "@/lib/report-schema";
import {
  COPY_COMPANY_NAME_BUTTON_ZH,
  CR_DATA_ATTRIBUTION_ZH,
  CR_ESERVICES_URL,
  CR_IDENTITY_AMBIGUOUS_ZH,
  CR_IDENTITY_FIELD_LABELS_ZH,
  CR_IDENTITY_INCONCLUSIVE_ZH,
  CR_IDENTITY_NOT_FOUND_ZH,
  CR_IDENTITY_SOURCE_LABEL_ZH,
  CR_LOOKUP_DEGRADED_ZH,
  REPORT_TRUST_FORBIDDEN_ZH,
  REPORT_TRUST_NEGATED_ALLOWLIST_ZH,
  crBrNoCompareNoteZh,
} from "@/lib/report-trust-copy-zh";

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

afterEach(() => cleanup());

function crRegistry(
  overrides: Partial<CompaniesRegistryOfficial> = {},
): CompaniesRegistryOfficial {
  return {
    lookupStatus: "ok",
    retrievedAt: "2026-10-18T12:00:00.000Z",
    hints: [],
    icrisHomeUrl: CR_ESERVICES_URL,
    ...overrides,
  };
}

function minimalReport(
  companiesRegistry?: CompaniesRegistryOfficial,
): RiskReport {
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
    official: {
      mwcMatched: false,
      ...(companiesRegistry ? { companiesRegistry } : {}),
    },
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
  };
}

describe("CompanyIdentityCard", () => {
  it("matched：顯示欄位、複製掣、來源與 brNo 核對", () => {
    const { container } = render(
      <CompanyIdentityCard
        report={minimalReport(
          crRegistry({
            matched: true,
            brNo: "C1111111",
            nameZh: "合成測試有限公司",
            nameEn: "SYNTHETIC TEST LIMITED",
            companyType: "Private company limited by shares",
            incorporationDate: "2010-01-02",
          }),
        )}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(container.textContent).toContain(CR_IDENTITY_FIELD_LABELS_ZH.brNo);
    expect(container.textContent).toContain("C1111111");
    expect(container.textContent).toContain("合成測試有限公司");
    expect(container.textContent).toContain("SYNTHETIC TEST LIMITED");
    expect(container.textContent).toContain("Private company limited by shares");
    expect(container.textContent).toContain("2010-01-02");
    expect(screen.getByText(COPY_COMPANY_NAME_BUTTON_ZH)).toBeTruthy();
    expect(container.textContent).toContain(CR_IDENTITY_SOURCE_LABEL_ZH);
    expect(container.textContent).toContain(CR_DATA_ATTRIBUTION_ZH);
    expect(container.textContent).toContain(crBrNoCompareNoteZh("C1111111"));
  });

  it("matched 無 brNo：唔顯示商業登記號碼 label", () => {
    const { container } = render(
      <CompanyIdentityCard
        report={minimalReport(crRegistry({ matched: true, nameZh: "合成測試有限公司" }))}
      />,
    );
    expect(container.textContent).not.toContain(CR_IDENTITY_FIELD_LABELS_ZH.brNo);
  });

  it("ambiguous：唔顯示 brNo／名稱", () => {
    const { container } = render(
      <CompanyIdentityCard
        report={minimalReport(
          crRegistry({
            matched: false,
            matchAmbiguous: true,
            brNo: "C1111111",
            nameZh: "合成測試有限公司",
          }),
        )}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(container.textContent).toContain(CR_IDENTITY_AMBIGUOUS_ZH);
    expect(container.textContent).not.toContain("C1111111");
    expect(container.textContent).not.toContain("合成測試有限公司");
  });

  it("not_found hint", () => {
    const { container } = render(
      <CompanyIdentityCard
        report={minimalReport(
          crRegistry({
            matched: false,
            hints: ["not_found_in_active_list"],
          }),
        )}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(container.textContent).toContain(CR_IDENTITY_NOT_FOUND_ZH);
  });

  it("inconclusive", () => {
    const { container } = render(
      <CompanyIdentityCard
        report={minimalReport(crRegistry({ matched: false, hints: [] }))}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(container.textContent).toContain(CR_IDENTITY_INCONCLUSIVE_ZH);
  });

  it("timeout：degraded 文案、冇 CR 連結", () => {
    const { container } = render(
      <CompanyIdentityCard
        report={minimalReport(crRegistry({ lookupStatus: "timeout" }))}
      />,
    );
    assertClean(container.textContent ?? "");
    expect(container.textContent).toContain(CR_LOOKUP_DEGRADED_ZH);
    expect(container.querySelector(`a[href="${CR_ESERVICES_URL}"]`)).toBeNull();
  });

  it("error：degraded 文案", () => {
    const { container } = render(
      <CompanyIdentityCard
        report={minimalReport(crRegistry({ lookupStatus: "error" }))}
      />,
    );
    expect(container.textContent).toContain(CR_LOOKUP_DEGRADED_ZH);
  });

  it("skipped／undefined：null", () => {
    const { container: c1 } = render(
      <CompanyIdentityCard report={minimalReport()} />,
    );
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(
      <CompanyIdentityCard
        report={minimalReport(crRegistry({ lookupStatus: "skipped" }))}
      />,
    );
    expect(c2.firstChild).toBeNull();
  });
});
