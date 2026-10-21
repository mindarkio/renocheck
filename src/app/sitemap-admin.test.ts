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

  it("robots does not advertise /admin in disallow", () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const disallow = list.flatMap((r) => r.disallow ?? []);
    expect(disallow).not.toContain("/admin");
    expect(disallow).toContain("/api/");
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

  it("next.config sets no-store and X-Robots-Tag on /admin", async () => {
    const { default: nextConfig } = await import("../../next.config");
    const headers = await nextConfig.headers?.();
    const admin = headers?.find((h) => h.source === "/admin/:path*");
    expect(admin?.headers).toEqual(
      expect.arrayContaining([
        { key: "Cache-Control", value: "no-store" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ]),
    );
  });
});
