import { describe, expect, it } from "vitest";
import { resolveProfileMaxPages } from "./d1-crawl-pages";

describe("resolveProfileMaxPages", () => {
  it("full uses observedHits with cap", () => {
    expect(
      resolveProfileMaxPages(
        { observedHitsJu: 749, maxPagesDefault: 8 },
        "full",
        { resultsPerPage: 10, maxPagesCapPerProfile: 80 },
      ),
    ).toBe(75);
  });

  it("full falls back to maxPagesDefault without hits", () => {
    expect(resolveProfileMaxPages({ maxPagesDefault: 15 }, "full")).toBe(15);
  });

  it("profile mode ignores hard cap", () => {
    expect(resolveProfileMaxPages({ maxPagesDefault: 15 }, "profile")).toBe(15);
  });

  it("default PoC caps at 8", () => {
    expect(resolveProfileMaxPages({ maxPagesDefault: 15 }, null)).toBe(8);
  });
});
