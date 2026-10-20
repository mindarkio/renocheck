// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { RiskReport } from "@/lib/report-schema";
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

describe("ReportCard section render order", () => {
  it("名富 fixture：heading id DOM 次序不變", () => {
    const report = loadFixtureReport("04272ad765a4dd910cf151aee5f04c23");
    const { container } = render(<ReportCard report={report} />);
    expect(headingIds(container)).toEqual(MINGFU_HEADING_ORDER);
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
