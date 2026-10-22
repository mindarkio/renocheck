import { describe, expect, it } from "vitest";
import {
  legalEventsPanelClass,
  reportGridClass,
  reportMainColumnClass,
  reportPageColumnClass,
  siteLayoutContainerClass,
  siteLayoutGutterClass,
} from "./report-column";

describe("report column widths", () => {
  it("site shell uses PRU-1 container breakpoints", () => {
    expect(siteLayoutContainerClass).toContain("max-w-[640px]");
    expect(siteLayoutGutterClass).toContain("lg:px-10");
    expect(siteLayoutContainerClass).toContain("min-[1024px]:max-w-[calc(100%-5rem)]");
    expect(siteLayoutContainerClass).toContain("min-[1280px]:max-w-[1120px]");
    expect(siteLayoutContainerClass).toContain("min-[1440px]:max-w-[1200px]");
  });

  it("report page uses the shared container", () => {
    expect(reportPageColumnClass).toBe(siteLayoutContainerClass);
  });

  it("lg grid is 12 columns with 24px gutter", () => {
    expect(reportGridClass).toContain("lg:grid-cols-12");
    expect(reportGridClass).toContain("lg:gap-x-6");
    expect(reportMainColumnClass).toContain("lg:col-span-8");
  });

  it("judgments panel stays inside main column", () => {
    expect(legalEventsPanelClass).not.toContain("lg:max-w-none");
    expect(legalEventsPanelClass).toContain("w-full");
  });
});
