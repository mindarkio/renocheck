// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_DELETE_CLOSED_ZH } from "@/lib/quote-analysis/copy";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: vi.fn(async () => null),
}));

import AccountPage from "./page";

describe("account page when signed out", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("gives the email deletion path while login is closed", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    render(await AccountPage());
    expect(document.body.textContent).toContain(ACCOUNT_DELETE_CLOSED_ZH);
    expect(document.querySelector("a[href='mailto:hello@renocheck.homes']")).toBeTruthy();
  });

  it("does not add the closed-login sentence when the flag is on", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    render(await AccountPage());
    expect(document.body.textContent).not.toContain(ACCOUNT_DELETE_CLOSED_ZH);
  });
});
