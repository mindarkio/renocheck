// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_DELETE_CLOSED_ZH,
  LOGIN_EMAIL_LABEL_ZH,
  LOGIN_UNAVAILABLE_ZH,
} from "@/lib/quote-analysis/copy";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import LoginPage from "./page";

describe("login closed message", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("keeps sign-in closed and tells people to email for deletion", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(LOGIN_UNAVAILABLE_ZH)).toBeTruthy();
    expect(document.body.textContent).toContain(ACCOUNT_DELETE_CLOSED_ZH);
    expect(screen.getByRole("link", { name: "hello@renocheck.homes" }).getAttribute("href")).toBe(
      "mailto:hello@renocheck.homes",
    );
    expect(screen.queryByLabelText(LOGIN_EMAIL_LABEL_ZH)).toBeNull();
  });

  it("shows the sign-in form when the flag and Supabase are configured", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByLabelText(LOGIN_EMAIL_LABEL_ZH)).toBeTruthy();
    expect(document.body.textContent).not.toContain(ACCOUNT_DELETE_CLOSED_ZH);
  });
});
