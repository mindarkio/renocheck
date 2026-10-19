import { describe, expect, it } from "vitest";
import {
  legalEventsPanelClass,
  reportPageColumnClass,
  reportReadingColumnClass,
} from "./report-column";

describe("report column widths", () => {
  it("prose stays on the 584px reading measure", () => {
    expect(reportReadingColumnClass).toContain("max-w-[584px]");
    expect(reportReadingColumnClass).not.toContain("lg:max-w");
  });

  it("report page can grow at lg so the judgments panel has room", () => {
    expect(reportPageColumnClass).toContain("max-w-[584px]");
    expect(reportPageColumnClass).toContain("lg:max-w-7xl");
  });

  it("judgments panel fills the page shell only from lg", () => {
    expect(legalEventsPanelClass).toContain("max-w-[584px]");
    expect(legalEventsPanelClass).toContain("lg:max-w-none");
  });
});