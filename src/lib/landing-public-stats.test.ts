import { describe, expect, it } from "vitest";
import { formatMwcRegistryUpdatedAt } from "./landing-public-stats";

describe("formatMwcRegistryUpdatedAt", () => {
  it("formats ISO date in zh-HK", () => {
    const label = formatMwcRegistryUpdatedAt("2026-01-15T00:00:00.000Z");
    expect(label).toMatch(/2026/);
    expect(label.length).toBeGreaterThan(4);
  });
});
