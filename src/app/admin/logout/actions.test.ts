import { describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/auth";

const setMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: setMock,
  })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

describe("submitAdminLogout", () => {
  it("clears session cookie and redirects to login", async () => {
    setMock.mockClear();
    const { submitAdminLogout } = await import("@/app/admin/logout/actions");
    await expect(submitAdminLogout()).rejects.toThrow("REDIRECT:/admin/login");
    expect(setMock).toHaveBeenCalledWith(
      ADMIN_SESSION_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0, path: "/admin", httpOnly: true }),
    );
  });
});
