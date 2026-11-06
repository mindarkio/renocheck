import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ssr = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: ssr.createServerClient }));

import { config as proxyConfig, proxy } from "@/proxy";
import {
  isAuthSessionPath,
  refreshSupabaseSession,
  shouldRefreshAuthSession,
} from "@/lib/supabase/proxy-session";

function req(path: string, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("Supabase session refresh in the proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
    ssr.getUser.mockReset();
    ssr.createServerClient.mockReset();
    ssr.createServerClient.mockImplementation(
      (_url: string, _key: string, options: { cookies: { setAll: (c: unknown[]) => void } }) => ({
        auth: {
          getUser: async () => {
            options.cookies.setAll([
              { name: "sb-local-auth-token", value: "rotated", options: { path: "/", httpOnly: true } },
            ]);
            return ssr.getUser();
          },
        },
      }),
    );
  });

  afterEach(() => vi.unstubAllEnvs());

  it("covers the signed-in pages and keeps the old matchers", () => {
    for (const p of ["/account", "/account/delete", "/login", "/quote/upload", "/quote/analyses/abc"]) {
      expect(isAuthSessionPath(p)).toBe(true);
    }
    expect(shouldRefreshAuthSession("/account/delete")).toBe(true);
    expect(isAuthSessionPath("/quote")).toBe(false);
    expect(proxyConfig.matcher).toEqual(
      expect.arrayContaining(["/report/:path*", "/admin", "/account", "/quote/analyses/:path*"]),
    );
  });

  it("never calls Supabase for visitors without a session cookie", async () => {
    const res = await proxy(req("/account"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(ssr.createServerClient).not.toHaveBeenCalled();
  });

  it("writes rotated cookies back on the response", async () => {
    const res = await refreshSupabaseSession(req("/account", "sb-local-auth-token=old"));
    expect(ssr.createServerClient).toHaveBeenCalledOnce();
    expect(ssr.createServerClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        cookieOptions: { httpOnly: true, secure: false },
      }),
    );
    expect(res.cookies.get("sb-local-auth-token")?.value).toBe("rotated");
  });

  it("marks the session cookie secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await refreshSupabaseSession(req("/account", "sb-local-auth-token=old"));
    expect(ssr.createServerClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        cookieOptions: { httpOnly: true, secure: true },
      }),
    );
  });

  it("skips the production project outside Vercel production", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lvrasvtilgzwtfsfjbzd.supabase.co");
    vi.stubEnv("VERCEL_ENV", "preview");
    await refreshSupabaseSession(req("/account", "sb-x=1"));
    expect(ssr.createServerClient).not.toHaveBeenCalled();
  });

  it("does not call Supabase auth for quote pages while the flag is off", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    expect(shouldRefreshAuthSession("/account")).toBe(true);
    expect(shouldRefreshAuthSession("/login")).toBe(true);
    expect(shouldRefreshAuthSession("/quote/upload")).toBe(false);
    expect(shouldRefreshAuthSession("/quote/analyses/abc")).toBe(false);

    for (const path of ["/quote/upload", "/quote/analyses/abc"]) {
      ssr.createServerClient.mockClear();
      const res = await proxy(req(path, "sb-local-auth-token=old"));
      expect(res.status).not.toBe(404);
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(ssr.createServerClient).not.toHaveBeenCalled();
    }

    ssr.createServerClient.mockClear();
    const account = await proxy(req("/account", "sb-local-auth-token=old"));
    expect(ssr.createServerClient).toHaveBeenCalledOnce();
    expect(account.cookies.get("sb-local-auth-token")?.value).toBe("rotated");

    ssr.createServerClient.mockClear();
    await proxy(req("/login", "sb-local-auth-token=old"));
    expect(ssr.createServerClient).toHaveBeenCalledOnce();
  });

  it("refreshes quote pages when the flag is on and a session cookie is present", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    expect(shouldRefreshAuthSession("/quote/upload")).toBe(true);
    expect(shouldRefreshAuthSession("/quote/analyses/abc")).toBe(true);
    const res = await proxy(req("/quote/analyses/abc", "sb-local-auth-token=old"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(ssr.createServerClient).toHaveBeenCalledOnce();
    expect(res.cookies.get("sb-local-auth-token")?.value).toBe("rotated");
  });
});
