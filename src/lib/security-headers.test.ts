import { describe, expect, it } from "vitest";
import { JUDICIARY_DCL_SEARCH_ACTION } from "@/lib/judiciary-search-deep-links";
import {
  JUDICIARY_FORM_ACTION_URL,
  SECURITY_HEADERS_SOURCE,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  type SecurityHeader,
} from "@/lib/security-headers";

const PRODUCTION_DIRECTIVES = [
  "default-src",
  "script-src",
  "script-src-attr",
  "style-src",
  "img-src",
  "font-src",
  "connect-src",
  "manifest-src",
  "frame-src",
  "worker-src",
  "object-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
  "upgrade-insecure-requests",
] as const;

const PRIVATE_HEADER_RULES = [
  "/quote/analyses/:path*",
  "/account",
  "/account/:path*",
  "/login",
  "/quote/upload",
  "/api/auth/:path*",
  "/api/quote/:path*",
] as const;

function directiveMap(policy: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of policy.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...rest] = trimmed.split(/\s+/);
    if (!name) continue;
    map.set(name, rest.join(" "));
  }
  return map;
}

function headerMap(headers: SecurityHeader[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const header of headers) {
    expect(map.has(header.key)).toBe(false);
    map.set(header.key, header.value);
  }
  return map;
}

describe("buildSecurityHeaders", () => {
  it("sends the enforced production policy and the companion headers", () => {
    const headers = buildSecurityHeaders({ dev: false });
    const map = headerMap(headers);

    expect([...map.keys()]).toEqual([
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
    ]);
    expect(map.has("Strict-Transport-Security")).toBe(false);
    expect(map.has("Content-Security-Policy-Report-Only")).toBe(false);
    expect(map.get("X-Frame-Options")).toBe("DENY");
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(map.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    );

    const policy = map.get("Content-Security-Policy") ?? "";
    const directives = directiveMap(policy);
    expect([...directives.keys()]).toEqual([...PRODUCTION_DIRECTIVES]);
    expect(directives.get("default-src")).toBe("'self'");
    expect(directives.get("script-src")).toBe("'self' 'unsafe-inline'");
    expect(directives.get("script-src-attr")).toBe("'none'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("vercel.live");
    expect(directives.get("style-src")).toBe("'self' 'unsafe-inline'");
    expect(directives.get("img-src")).toBe("'self' data: blob:");
    expect(directives.get("font-src")).toBe("'self'");
    expect(directives.get("connect-src")).toBe("'self'");
    expect(directives.get("manifest-src")).toBe("'self'");
    expect(directives.get("frame-src")).toBe("'none'");
    expect(directives.get("worker-src")).toBe("'none'");
    expect(directives.get("object-src")).toBe("'none'");
    expect(directives.get("base-uri")).toBe("'none'");
    // Literal pin: a loosened constant ("https:", "*", another host) must fail here.
    expect(directives.get("form-action")).toBe(
      "'self' https://e-services.judiciary.hk/dcl/search.jsp",
    );
    expect(directives.get("frame-ancestors")).toBe("'none'");
    expect(directives.get("upgrade-insecure-requests")).toBe("");
    expect(policy).not.toContain("supabase.co");
    expect(policy).not.toContain("fonts.googleapis.com");
  });

  it("adds unsafe-eval only for the dev server", () => {
    const dev = directiveMap(buildContentSecurityPolicy({ dev: true }));
    const prod = directiveMap(buildContentSecurityPolicy({ dev: false }));
    expect(dev.get("script-src")).toBe(
      "'self' 'unsafe-inline' 'unsafe-eval'",
    );
    expect(prod.get("script-src")).toBe("'self' 'unsafe-inline'");
    expect(dev.has("upgrade-insecure-requests")).toBe(false);
    expect(prod.get("upgrade-insecure-requests")).toBe("");
    expect(buildSecurityHeaders({ dev: true }).map((header) => header.key)).not.toContain(
      "Strict-Transport-Security",
    );
  });
});

describe("form-action matches the cause-list form", () => {
  it("allows exactly the URL DailyCauseListSearchForm posts to", () => {
    expect(JUDICIARY_FORM_ACTION_URL).toBe(JUDICIARY_DCL_SEARCH_ACTION);
    const formAction = directiveMap(buildContentSecurityPolicy({ dev: false })).get("form-action") ?? "";
    expect(formAction.split(" ")).toContain(JUDICIARY_DCL_SEARCH_ACTION);
  });
});

describe("next.config headers()", () => {
  it("applies site-wide security headers without changing private-route rules", async () => {
    const { default: nextConfig } = await import("../../next.config");
    const rules = (await nextConfig.headers?.()) ?? [];

    expect(rules[0]).toMatchObject({ source: SECURITY_HEADERS_SOURCE });
    expect(rules[0]?.source).toBe("/:path*");
    expect(rules.filter((rule) => rule.source === "/:path*")).toHaveLength(1);

    const siteWide = headerMap(rules[0]?.headers ?? []);
    expect(siteWide.get("Content-Security-Policy")).toBe(
      buildContentSecurityPolicy({ dev: false }),
    );
    expect(siteWide.get("X-Frame-Options")).toBe("DENY");
    expect(siteWide.has("Strict-Transport-Security")).toBe(false);
    for (const key of siteWide.keys()) {
      expect(key).not.toBe("Cache-Control");
      expect(key).not.toBe("X-Robots-Tag");
    }

    expect(rules.slice(1)).toEqual([
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      ...PRIVATE_HEADER_RULES.map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      })),
    ]);

    const securityKeys = new Set(siteWide.keys());
    for (const rule of rules.slice(1)) {
      for (const header of rule.headers) {
        expect(securityKeys.has(header.key)).toBe(false);
      }
    }
  });
});
