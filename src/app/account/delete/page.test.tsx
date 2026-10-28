// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_DELETE_BODY_ZH,
  ACCOUNT_DELETE_BUTTON_ZH,
  ACCOUNT_DELETE_HEADING_ZH,
} from "@/lib/quote-analysis/copy";

const redirectTo = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectTo(url);
    throw new Error(`redirect:${url}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: vi.fn(async () => null),
}));

import { getAuthUser } from "@/lib/supabase/server";
import DeleteAccountPage, { metadata } from "./page";

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "person@example.com" };

describe("delete account page", () => {
  afterEach(() => {
    cleanup();
    redirectTo.mockReset();
    vi.mocked(getAuthUser).mockReset();
    vi.mocked(getAuthUser).mockResolvedValue(null);
  });

  it("sends a signed-out visitor to login with a safe next", async () => {
    await expect(DeleteAccountPage()).rejects.toThrow("redirect:/login?next=/account/delete");
    expect(redirectTo).toHaveBeenCalledWith("/login?next=/account/delete");
  });

  it("shows the existing delete confirmation when signed in", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(USER);
    render(await DeleteAccountPage());
    expect(screen.getByRole("heading", { name: ACCOUNT_DELETE_HEADING_ZH })).toBeTruthy();
    expect(screen.getByText(ACCOUNT_DELETE_BODY_ZH)).toBeTruthy();
    expect(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON_ZH })).toBeTruthy();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
