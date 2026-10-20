import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENT_DIR = path.join(process.cwd(), "src/components");

const SHELL_AND_REPORT_FILES = [
  "ReportCard.tsx",
  "ReportView.tsx",
  "ReportSidebarToc.tsx",
  "LegalEventsTable.tsx",
  "CompanyIdentityCard.tsx",
  "RiskBandMeter.tsx",
  "DailyCauseListSearchForm.tsx",
  "SiteHeader.tsx",
  "SiteFooter.tsx",
];

function subTwelvePxLiterals(content: string): string[] {
  const hits: string[] = [];
  const pxRe = /text-\[(\d+(?:\.\d+)?)px\]/g;
  let m: RegExpExecArray | null;
  while ((m = pxRe.exec(content))) {
    if (parseFloat(m[1]) < 12) hits.push(m[0]);
  }
  const remRe = /text-\[(\d+(?:\.\d+)?)rem\]/g;
  while ((m = remRe.exec(content))) {
    if (parseFloat(m[1]) * 16 < 12) hits.push(m[0]);
  }
  return hits;
}

describe("report typography bounds", () => {
  it("report + shared chrome avoid sub-12px Tailwind literals", () => {
    for (const file of SHELL_AND_REPORT_FILES) {
      const content = readFileSync(path.join(COMPONENT_DIR, file), "utf8");
      expect(subTwelvePxLiterals(content), file).toEqual([]);
      expect(content, file).not.toMatch(/text-\[(9|10|11)px\]/);
    }
  });
});
