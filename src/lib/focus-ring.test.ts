import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOCUS_RING_NAVY,
  FOCUS_RING_ON_PRIMARY,
  blendHex,
  childFocusRingClass,
  contrastRatio,
  focusOnPrimaryClass,
  focusRingClass,
  focusRingOnPrimaryClass,
  searchFieldFocusRingClass,
} from "@/lib/focus-ring";

const ROOT = process.cwd();
const MIN_RATIO = 3;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(full);
  }
  return out;
}

describe("focus ring contrast", () => {
  const page = "#ffffff";
  const muted = "#f4f4f5";
  const amber = "#fffbeb";
  const mutedWash = blendHex(muted, page, 0.5);
  const primaryTint = blendHex(FOCUS_RING_NAVY, page, 0.05);
  const menu85 = blendHex(FOCUS_RING_NAVY, page, 0.85);
  const menu95 = blendHex(FOCUS_RING_NAVY, page, 0.95);

  it("keeps solid navy at least 3:1 on light surfaces", () => {
    for (const background of [page, muted, amber, mutedWash, primaryTint]) {
      expect(contrastRatio(FOCUS_RING_NAVY, background)).toBeGreaterThanOrEqual(MIN_RATIO);
    }
  });

  it("uses white where navy fails, including the translucent menu sheet", () => {
    expect(contrastRatio(FOCUS_RING_NAVY, FOCUS_RING_NAVY)).toBeLessThan(MIN_RATIO);
    expect(contrastRatio(FOCUS_RING_NAVY, menu85)).toBeLessThan(MIN_RATIO);
    expect(contrastRatio(FOCUS_RING_ON_PRIMARY, FOCUS_RING_NAVY)).toBeGreaterThanOrEqual(MIN_RATIO);
    expect(contrastRatio(FOCUS_RING_ON_PRIMARY, menu85)).toBeGreaterThanOrEqual(MIN_RATIO);
    expect(contrastRatio(FOCUS_RING_ON_PRIMARY, menu95)).toBeGreaterThanOrEqual(MIN_RATIO);
  });

  it("exports the header ring and the navy-surface override", () => {
    expect(focusRingClass).toContain("focus-visible:ring-primary");
    expect(focusRingClass).toContain("focus-visible:ring-offset-background");
    expect(focusRingClass).not.toMatch(/ring-primary\/\d/);
    expect(focusRingOnPrimaryClass).toContain("focus-visible:ring-white");
    expect(focusRingOnPrimaryClass).not.toMatch(/ring-white\/\d/);
    expect(focusOnPrimaryClass).toBe("focus-on-primary");
    expect(searchFieldFocusRingClass).toBe("search-field-focus");
  });
});

describe("focus ring source", () => {
  const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

  it("paints a 2px :focus-visible outline and flips it on navy", () => {
    expect(css).toContain("--focus-ring: var(--brand-navy)");
    expect(css).toContain("--focus-ring-on-primary: #ffffff");
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline-offset:\s*2px/);
    expect(css).toMatch(/\.focus-on-primary\s*\{[^}]*--focus-ring:\s*var\(--focus-ring-on-primary\)/);
    expect(css).toMatch(
      /\.search-field-focus:has\(input:focus-visible\)\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/,
    );
    expect(css).not.toMatch(/\.search-field-focus:focus-within/);
    expect(css).not.toMatch(/:focus\s*\{[^}]*outline:/);
  });

  it("does not leave translucent focus rings in components", () => {
    const forbidden = [
      /focus-visible:ring-(?:primary|white|primary-foreground)\/\d+/,
      /(?<![\w-])focus:ring-/,
      /ring-primary\/\d+/,
    ];
    const hits: string[] = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const text = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        if (pattern.test(text)) hits.push(`${path.relative(ROOT, file)} ${pattern}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps the white ring on navy surfaces and the quote radio label ring", () => {
    const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
    expect(read("src/components/ReportCard.tsx")).toMatch(
      /bg-primary px-5 py-5[^`]*\$\{focusOnPrimaryClass\}/,
    );
    expect(read("src/components/SiteFooter.tsx")).toMatch(/bg-primary[^`]*\$\{focusOnPrimaryClass\}/);
    expect(read("src/components/SiteHeader.tsx")).toMatch(/bg-primary\/95[^`]*\$\{focusOnPrimaryClass\}/);
    expect(childFocusRingClass).toContain("has-[:focus-visible]:ring-2");
    expect(childFocusRingClass).toContain("has-[:focus-visible]:ring-primary");
    expect(read("src/components/QuoteSelfCheck.tsx")).toContain("${childFocusRingClass}");
  });

  it("never uses outline-none on focus rings (forced-colors keeps outline-hidden)", () => {
    for (const cls of [focusRingClass, focusRingOnPrimaryClass]) {
      expect(cls).toContain("focus-visible:outline-hidden");
      expect(cls).not.toContain("outline-none");
    }
    const hits: string[] = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      if (/focus-visible:outline-none/.test(readFileSync(file, "utf8"))) {
        hits.push(path.relative(ROOT, file));
      }
    }
    expect(hits).toEqual([]);
  });

  it("only suppresses the global outline when another ring replaces it", () => {
    const hits: string[] = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const relative = path.relative(ROOT, file);
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
          return;
        }
        if (!line.includes("outline-none")) return;
        if (line.includes("ring-2")) return;
        if (
          relative === "src/components/SearchForm.tsx" &&
          line.includes("inputLanding")
        ) {
          return;
        }
        if (
          relative === "src/components/QuoteSelfCheck.tsx" &&
          (line.includes("focus:outline-none") || line.includes("accent-primary"))
        ) {
          return;
        }
        hits.push(`${relative}:${index + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
