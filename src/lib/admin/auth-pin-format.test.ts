import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminAuthConfig } from "@/lib/admin/auth";
import { randomTestPin, randomTestSecret } from "@/lib/admin/test-helpers";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";

describe("admin PIN format (digits only)", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("rejects non-digit, short, long and spaced env PINs", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    vi.stubEnv("ADMIN_DASHBOARD_PIN", "abcd");
    expect(getAdminAuthConfig()).toBeNull();
    vi.stubEnv("ADMIN_DASHBOARD_PIN", "123");
    expect(getAdminAuthConfig()).toBeNull();
    vi.stubEnv("ADMIN_DASHBOARD_PIN", `${"1".repeat(33)}`);
    expect(getAdminAuthConfig()).toBeNull();
    vi.stubEnv("ADMIN_DASHBOARD_PIN", `${randomTestPin(4)} ${randomTestPin(4)}`);
    expect(getAdminAuthConfig()).toBeNull();
  });

  it("accepts runtime-generated 4- and 32-digit env PINs", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    vi.stubEnv("ADMIN_DASHBOARD_PIN", randomTestPin(4));
    expect(getAdminAuthConfig()).not.toBeNull();
    vi.stubEnv("ADMIN_DASHBOARD_PIN", randomTestPin(32));
    expect(getAdminAuthConfig()).not.toBeNull();
  });

  it("proxy returns 404 for /admin when env PIN is invalid", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    vi.stubEnv("ADMIN_DASHBOARD_PIN", "abcd");
    const res = proxy(new NextRequest("https://renocheck.test/admin"));
    expect(res.status).toBe(404);
  });
});
