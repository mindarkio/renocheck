import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

describe("admin indexing", () => {
  it("sitemap excludes /admin", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes("/admin"))).toBe(false);
  });

  it("robots disallows /admin", () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const disallow = list.flatMap((r) => r.disallow ?? []);
    expect(disallow).toContain("/admin");
  });

  it("admin pages export noindex metadata", () => {
    const adminPage = readFileSync(
      path.join(process.cwd(), "src/app/admin/page.tsx"),
      "utf8",
    );
    const loginPage = readFileSync(
      path.join(process.cwd(), "src/app/admin/login/page.tsx"),
      "utf8",
    );
    expect(adminPage).toContain("index: false");
    expect(loginPage).toContain("index: false");
  });
});
