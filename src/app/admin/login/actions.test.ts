import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_COOKIE,
  pinDigestHex,
  resetAdminAuthStateForTests,
} from "@/lib/admin/auth";
import { randomTestPin, randomTestSecret } from "@/lib/admin/test-helpers";

const setMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const notFoundMock = vi.fn(() => {
  throw new Error("NOT_FOUND");
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: setMock })),
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.50" })),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  notFound: () => notFoundMock(),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

describe("submitAdminLogin", () => {
  beforeEach(() => {
    resetAdminAuthStateForTests();
    vi.unstubAllEnvs();
    setMock.mockClear();
    redirectMock.mockClear();
  });

  afterEach(() => {
    resetAdminAuthStateForTests();
    vi.unstubAllEnvs();
  });

  it("redirects to locked when IP is locked even with correct PIN", async () => {
    const pin = randomTestPin(8);
    vi.stubEnv("ADMIN_DASHBOARD_PIN", pin);
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    const { submitAdminLogin } = await import("@/app/admin/login/actions");
    const wrong = randomTestPin(8);
    for (let i = 0; i < 5; i++) {
      const fd = new FormData();
      fd.set("pin", wrong);
      await expect(submitAdminLogin(fd)).rejects.toThrow(/error=wrong|error=locked/);
    }
    const fd = new FormData();
    fd.set("pin", pin);
    await expect(submitAdminLogin(fd)).rejects.toThrow("REDIRECT:/admin/login?error=locked");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("sets rc_admin cookie with required flags and no PIN-derived segment", async () => {
    const pin = randomTestPin(6);
    vi.stubEnv("ADMIN_DASHBOARD_PIN", pin);
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    const digest = pinDigestHex(pin);
    const { submitAdminLogin } = await import("@/app/admin/login/actions");
    const fd = new FormData();
    fd.set("pin", pin);
    await expect(submitAdminLogin(fd)).rejects.toThrow("REDIRECT:/admin");
    expect(setMock).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      expect.stringMatching(/^v1\.\d+\.[0-9a-f]+\.[0-9a-f]{64}$/),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/admin",
        maxAge: 43200,
      }),
    );
    const value = String(setMock.mock.calls[0]?.[1]);
    const parts = value.split(".");
    expect(parts).toHaveLength(4);
    expect(value).not.toContain(pin);
    expect(value).not.toContain(digest);
    expect(value).not.toContain(digest.slice(0, 16));
  });

  it("never logs the PIN, the submitted value or the IP across the failure flow", async () => {
    const pin = randomTestPin(8);
    vi.stubEnv("ADMIN_DASHBOARD_PIN", pin);
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const { submitAdminLogin } = await import("@/app/admin/login/actions");
    const wrongDigits = randomTestPin(8);
    const sentinel = `SENTINEL_${randomTestPin(10)}`;
    for (const value of [wrongDigits, sentinel, wrongDigits, sentinel, wrongDigits, sentinel]) {
      const fd = new FormData();
      fd.set("pin", value);
      await expect(submitAdminLogin(fd)).rejects.toThrow(/error=wrong|error=locked/);
    }
    const payload = spies
      .flatMap((s) => s.mock.calls.map((c) => c.map(String).join(" ")))
      .join("\n");
    expect(payload).toContain("admin_login_failed");
    expect(payload).toContain("admin_login_locked");
    for (const secret of [pin, wrongDigits, sentinel, "203.0.113.50"]) {
      expect(payload).not.toContain(secret);
    }
    for (const s of spies) s.mockRestore();
  });

  it("calls notFound when env is missing", async () => {
    vi.stubEnv("ADMIN_DASHBOARD_PIN", "");
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    const { submitAdminLogin } = await import("@/app/admin/login/actions");
    const fd = new FormData();
    fd.set("pin", randomTestPin(4));
    await expect(submitAdminLogin(fd)).rejects.toThrow("NOT_FOUND");
  });
});
