// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { riskReportSchema, type RiskReport } from "@/lib/report-schema";
import { ReportCard } from "./ReportCard";

afterEach(() => cleanup());

function headingIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[id$='-heading']")].map(
    (el) => el.id,
  );
}

function loadFixtureReport(fp: string): RiskReport {
  const raw = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "src/test-fixtures/reports", `${fp}.json`),
      "utf8",
    ),
  ) as { report: RiskReport };
  return raw.report;
}

/** 名富 prod fixture — section id 次序（PRU-1 不得搬 section）。 */
const MINGFU_HEADING_ORDER = [
  "summary-heading",
  "scope-heading",
  "cr-identity-heading",
  "legal-events-heading",
  "checklist-heading",
  "next-steps-heading",
  "report-limits-heading",
  "official-verify-heading",
];

const FIXTURE_IDS = [
  "04272ad765a4dd910cf151aee5f04c23",
  "780b6902c105337959d12ec5464576d6",
  "HEAVY",
  "DEGRADED",
  "MWC_MISS",
] as const;

describe("ReportCard section render order", () => {
  it.each(FIXTURE_IDS)("fixture %s 符合 RiskReport schema", (fp) => {
    expect(riskReportSchema.safeParse(loadFixtureReport(fp)).success).toBe(
      true,
    );
  });

  it("名富 fixture：heading id DOM 次序不變", () => {
    const report = loadFixtureReport("04272ad765a4dd910cf151aee5f04c23");
    const { container } = render(<ReportCard report={report} />);
    expect(headingIds(container)).toEqual(MINGFU_HEADING_ORDER);
  });

  it.each([
    [
      "HEAVY",
      [
        "summary-heading",
        "scope-heading",
        "cr-identity-heading",
        "legal-events-heading",
        "actionable-heading",
        "highlights-heading",
        "checklist-heading",
        "next-steps-heading",
        "report-limits-heading",
        "official-verify-heading",
      ],
    ],
    [
      "DEGRADED",
      [
        "summary-heading",
        "scope-heading",
        "cr-identity-heading",
        "legal-events-heading",
        "checklist-heading",
        "next-steps-heading",
        "report-limits-heading",
        "official-verify-heading",
      ],
    ],
    [
      "MWC_MISS",
      [
        "summary-heading",
        "cr-identity-heading",
        "mwc-miss-note-heading",
        "checklist-heading",
        "next-steps-heading",
        "report-limits-heading",
        "official-verify-heading",
      ],
    ],
  ] as const)("%s heading 次序", (fp, order) => {
    const { container } = render(
      <ReportCard report={loadFixtureReport(fp)} />,
    );
    expect(headingIds(container)).toEqual([...order]);
  });

  it("heading level 唔跳級，身份卡係 h2，自助區係 h3", () => {
    const { container } = render(
      <ReportCard
        report={loadFixtureReport("04272ad765a4dd910cf151aee5f04c23")}
      />,
    );
    const levels = [...container.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(
      (el) => Number(el.tagName.slice(1)),
    );
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual((levels[i - 1] ?? 1) + 1);
    }
    expect(container.querySelector("h2#cr-identity-heading")).not.toBeNull();
    expect(container.querySelector("h4")).toBeNull();
    expect(container.querySelector("h3")).not.toBeNull();
  });

  it("只有一個 h1（公司名）", () => {
    const report = loadFixtureReport("04272ad765a4dd910cf151aee5f04c23");
    const { container } = render(<ReportCard report={report} />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("h1")?.textContent).toContain(
      "名富工程服務有限公司",
    );
  });
});
