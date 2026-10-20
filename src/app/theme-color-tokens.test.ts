import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");
const GLOBALS = path.join(SRC, "app/globals.css");
const TAILWIND_THEME = path.join(
  ROOT,
  "node_modules/tailwindcss/theme.css",
);

/** Text/background utilities that are not colours. */
const NON_COLOR_TEXT = new Set([
  "left",
  "center",
  "right",
  "justify",
  "start",
  "end",
  "wrap",
  "nowrap",
  "balance",
  "pretty",
  "ellipsis",
  "clip",
]);

const NON_COLOR_BG = new Set([
  "none",
  "auto",
  "cover",
  "contain",
  "fixed",
  "local",
  "scroll",
  "bottom",
  "center",
  "left",
  "right",
  "top",
  "left-bottom",
  "left-top",
  "right-bottom",
  "right-top",
  "repeat",
  "no-repeat",
  "repeat-x",
  "repeat-y",
  "repeat-round",
  "repeat-space",
]);

const SPECIAL_COLORS = new Set(["inherit", "current", "transparent"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx|css)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function themeColorNames(css: string): Set<string> {
  const names = new Set<string>();
  for (const match of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) {
    names.add(match[1] ?? "");
  }
  names.delete("");
  return names;
}

function themeTextSizes(css: string): Set<string> {
  const names = new Set<string>();
  for (const match of css.matchAll(/--text-([a-z0-9-]+)\s*:/g)) {
    const name = match[1] ?? "";
    if (!name.endsWith("--line-height")) names.add(name);
  }
  return names;
}

function customProperties(css: string): Map<string, string> {
  const decls = new Map<string, string>();
  for (const match of css.matchAll(/--([A-Za-z0-9-]+)\s*:\s*([^;]+);/g)) {
    decls.set(`--${match[1]}`, (match[2] ?? "").trim());
  }
  return decls;
}

function resolveColor(name: string, decls: Map<string, string>): string {
  const seen = new Set<string>();
  let current = name;
  for (let i = 0; i < 8; i += 1) {
    if (seen.has(current)) {
      throw new Error(`colour token cycle at ${current}`);
    }
    seen.add(current);
    const value = decls.get(current);
    if (!value) throw new Error(`${current} is not defined in globals.css`);
    const ref = value.match(/^var\(\s*(--[A-Za-z0-9-]+)\s*\)$/);
    if (!ref) return value;
    current = ref[1] ?? current;
  }
  throw new Error(`${name} did not resolve to a colour`);
}

function isOpaqueColor(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v) || /^#[0-9a-f]{6}$/.test(v)) return true;
  if (/^#[0-9a-f]{4}$/.test(v)) return v.endsWith("f");
  if (/^#[0-9a-f]{8}$/.test(v)) return v.endsWith("ff");
  return false;
}

function isConcreteColor(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (isOpaqueColor(v)) return true;
  if (v === "transparent" || v === "currentcolor" || v === "inherit") return true;
  return /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/.test(v);
}

function braceBlocks(css: string, header: RegExp): string[] {
  const blocks: string[] = [];
  for (const match of css.matchAll(header)) {
    const from = (match.index ?? 0) + match[0].length;
    const start = css.indexOf("{", from);
    if (start < 0) continue;
    let depth = 0;
    for (let i = start; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(css.slice(start + 1, i));
          break;
        }
      }
    }
  }
  return blocks;
}

function isNonColorUtility(kind: "bg" | "text", token: string): boolean {
  if (kind === "text" && NON_COLOR_TEXT.has(token)) return true;
  if (kind === "bg" && NON_COLOR_BG.has(token)) return true;
  if (
    kind === "bg" &&
    /^(?:gradient|linear|radial|conic|clip|origin)-/.test(token)
  ) {
    return true;
  }
  return false;
}

type Usage = { kind: "bg" | "text"; token: string; file: string };

function colorUsages(files: string[]): Usage[] {
  const re =
    /(?:^|[^\w-])(?:(?:\[[^\]]+\]|[\w-])+:)*(?:!)?(bg|text)-([a-z][a-z0-9-]*)\b/g;
  const usages: Usage[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(re)) {
      const kind = match[1] === "bg" ? "bg" : "text";
      const token = match[2] ?? "";
      if (!token || isNonColorUtility(kind, token)) continue;
      usages.push({
        kind,
        token,
        file: path.relative(ROOT, file),
      });
    }
  }
  return usages;
}

describe("theme colour tokens", () => {
  const globals = readFileSync(GLOBALS, "utf8");
  const tailwindTheme = readFileSync(TAILWIND_THEME, "utf8");
  const projectColors = themeColorNames(globals);
  const builtinColors = themeColorNames(tailwindTheme);
  const fontSizes = themeTextSizes(tailwindTheme);
  const decls = customProperties(globals);

  it("defines an opaque card pair that matches the page surface", () => {
    expect(projectColors.has("card")).toBe(true);
    expect(projectColors.has("card-foreground")).toBe(true);

    const card = resolveColor("--color-card", decls);
    const cardForeground = resolveColor("--color-card-foreground", decls);
    const background = resolveColor("--background", decls);
    const foreground = resolveColor("--foreground", decls);

    expect(isOpaqueColor(card)).toBe(true);
    expect(isOpaqueColor(cardForeground)).toBe(true);
    expect(card).toBe(background);
    expect(cardForeground).toBe(foreground);
    expect(card).not.toBe(cardForeground);
  });

  it("resolves every custom bg-* and text-* token used in src", () => {
    const missing: string[] = [];
    const seen = new Set<string>();
    for (const usage of colorUsages(walk(SRC))) {
      if (fontSizes.has(usage.token) && usage.kind === "text") continue;
      if (builtinColors.has(usage.token) || SPECIAL_COLORS.has(usage.token)) {
        continue;
      }
      const key = `${usage.kind}-${usage.token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const themeName = `--color-${usage.token}`;
      if (!projectColors.has(usage.token)) {
        missing.push(`${key} in ${usage.file} has no ${themeName} in @theme`);
        continue;
      }
      let resolved = "";
      try {
        resolved = resolveColor(themeName, decls);
      } catch (error) {
        missing.push(
          `${key} in ${usage.file}: ${error instanceof Error ? error.message : "unresolved"}`,
        );
        continue;
      }
      if (!isConcreteColor(resolved)) {
        missing.push(
          `${key} in ${usage.file} resolved to ${resolved}, which is not a colour`,
        );
      }
    }
    expect(missing).toEqual([]);
    expect(seen.has("bg-card")).toBe(true);
  });

  it("requires an opaque --card inside a dark palette", () => {
    const blocks = [
      ...braceBlocks(globals, /@media[^{]*prefers-color-scheme:\s*dark/g),
      ...braceBlocks(globals, /(^|[\s{])\.dark(?=[\s{,:])/g),
    ];
    for (const block of blocks) {
      if (!/--(?:background|foreground|card|primary|muted)\s*:/.test(block)) {
        continue;
      }
      const card = block.match(/--card\s*:\s*([^;]+);/)?.[1]?.trim();
      const foreground = block.match(
        /--card-foreground\s*:\s*([^;]+);/,
      )?.[1]?.trim();
      expect(card, "dark palette must set --card").toBeTruthy();
      expect(foreground, "dark palette must set --card-foreground").toBeTruthy();
      expect(isOpaqueColor(card ?? "")).toBe(true);
      expect(isOpaqueColor(foreground ?? "")).toBe(true);
    }
  });
});
