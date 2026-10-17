import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listD2RulesBundleFiles } from "./judgment-d2-rules-bundle";
import { d2RulesBundleContentSha } from "./judgment-d2-filter-cache";

describe("listD2RulesBundleFiles", () => {
  it("includes core gate modules and config", () => {
    const files = listD2RulesBundleFiles();
    expect(files).toContain("src/lib/judgment-d2-gates.ts");
    expect(files).toContain("src/lib/judgment-d2-manual-triage.ts");
    expect(files).toContain("scripts/config/court-from-case-ref.json");
    expect(files.some((f) => f.endsWith(".test.ts"))).toBe(false);
  });

  it("every listed file exists on disk", () => {
    const root = process.cwd();
    for (const rel of listD2RulesBundleFiles()) {
      expect(existsSync(resolve(root, rel)), rel).toBe(true);
    }
  });

  it("matches d2RulesBundleContentSha inputs", () => {
    expect(d2RulesBundleContentSha()).toMatch(/^[a-f0-9]{16}$/);
    expect(listD2RulesBundleFiles().length).toBeGreaterThan(5);
  });
});
