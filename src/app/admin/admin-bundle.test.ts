import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(name.name)) out.push(full);
  }
  return out;
}

describe("admin bundle hygiene", () => {
  it("has no use client under src/app/admin", () => {
    const adminDir = path.join(SRC, "app/admin");
    for (const file of walk(adminDir)) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/['"]use client['"]/);
    }
  });

  it("supabase admin client is not imported from client components", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file.includes("supabase/admin.ts")) continue;
      const src = readFileSync(file, "utf8");
      if (!src.includes("@/lib/supabase/admin")) continue;
      if (src.match(/['"]use client['"]/)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
