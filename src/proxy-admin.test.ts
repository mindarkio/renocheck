import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_COOKIE,
  buildSessionToken,
  getAdminAuthConfig,
} from "@/lib/admin/auth";
import { randomTestPin, randomTestSecret } from "@/lib/admin/test-helpers";
import { config as proxyConfig, proxy } from "@/proxy";

const req = (path: string, cookie?: string) =>
  new NextRequest(`https://renocheck.test${path}`, {
    headers: cookie ? { cookie: `${ADMIN_SESSION_COOKIE}=${cookie}` } : {},
  });

function enable() {
  const pin = randomTestPin(12);
  vi.stubEnv("ADMIN_DASHBOARD_PIN", pin);
  vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
  return pin;
}

/** next.config headers() owns these. A proxy response that sets one replaces the config value. */
const CONFIG_SECURITY_HEADERS = [
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "strict-transport-security",
] as const;

function expectNoSecurityHeaders(res: Response) {
  for (const key of CONFIG_SECURITY_HEADERS) expect(res.headers.has(key)).toBe(false);
}

describe("proxy /admin gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("matches /admin and /admin/* only (public routes use other matchers)", () => {
    expect(proxyConfig.matcher).toEqual(
      expect.arrayContaining(["/admin", "/admin/:path*"]),
    );
    expect(proxyConfig.matcher).not.toContain("/");
    expect(proxyConfig.matcher).not.toContain("/faq");
  });

  it("real 404 on /admin paths when env is missing", async () => {
    vi.stubEnv("ADMIN_DASHBOARD_PIN", "");
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    for (const p of ["/admin", "/admin/", "/admin/login", "/admin/xyz"]) {
      const res = await proxy(req(p));
      expect(res.status).toBe(404);
      expect(res.headers.get("x-robots-tag")).toContain("noindex");
      expectNoSecurityHeaders(res);
    }
  });

  it("real 307 to /admin/login without a valid session", async () => {
    enable();
    for (const cookie of [undefined, "v1.1.2.3", "garbage"]) {
      const res = await proxy(req("/admin?days=7", cookie));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/login");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-robots-tag")).toContain("noindex");
      expectNoSecurityHeaders(res);
    }
  });

  it("passes /admin/login and a valid session through", async () => {
    const pin = enable();
    expect((await proxy(req("/admin/login"))).headers.get("x-middleware-next")).toBe("1");
    const token = buildSessionToken(getAdminAuthConfig()!, pin, Date.now());
    const res = await proxy(req("/admin", token));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
