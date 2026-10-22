import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/admin/session", () => ({
  isAdminSessionValid: vi.fn().mockResolvedValue(false),
  adminEnvPin: vi.fn(),
}));

describe("admin pages feature flag", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("calls notFound when dashboard env is missing", async () => {
    vi.stubEnv("ADMIN_DASHBOARD_PIN", "");
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    const { default: AdminPage } = await import("@/app/admin/page");
    await expect(
      AdminPage({
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("calls notFound on login when dashboard env is missing", async () => {
    vi.stubEnv("ADMIN_DASHBOARD_PIN", "");
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    const { default: LoginPage } = await import("@/app/admin/login/page");
    await expect(
      LoginPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("redirects login to /admin when session is valid", async () => {
    const { randomTestPin, randomTestSecret } = await import("@/lib/admin/test-helpers");
    vi.stubEnv("ADMIN_DASHBOARD_PIN", randomTestPin(12));
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    const session = await import("@/lib/admin/session");
    vi.mocked(session.isAdminSessionValid).mockResolvedValue(true);
    vi.resetModules();
    const { default: LoginPage } = await import("@/app/admin/login/page");
    await expect(
      LoginPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/admin");
  });
});
