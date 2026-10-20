import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPORT_COMPONENT_DIR = path.join(process.cwd(), "src/components");

const REPORT_COMPONENT_FILES = [
  "ReportCard.tsx",
  "ReportView.tsx",
  "ReportSidebarToc.tsx",
  "LegalEventsTable.tsx",
  "CompanyIdentityCard.tsx",
  "RiskBandMeter.tsx",
  "DailyCauseListSearchForm.tsx",
];

describe("report typography bounds", () => {
  it("report components avoid sub-12px Tailwind sizes", () => {
    const forbidden = /text-\[(9|10|11)px\]/;
    for (const file of REPORT_COMPONENT_FILES) {
      const content = readFileSync(path.join(REPORT_COMPONENT_DIR, file), "utf8");
      expect(content, file).not.toMatch(forbidden);
    }
  });
});
