// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_DELETE_CLOSED_ZH,
  ACCOUNT_DELETE_HEADING_ZH,
  ACCOUNT_UPLOAD_ACTION_ZH,
} from "@/lib/quote-analysis/copy";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: vi.fn(async () => null),
}));

import { getAuthUser } from "@/lib/supabase/server";
import AccountPage from "./page";

describe("account page when signed out", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.mocked(getAuthUser).mockResolvedValue(null);
  });

  it("gives the email deletion path while login is closed", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    render(await AccountPage());
    expect(document.body.textContent).toContain(ACCOUNT_DELETE_CLOSED_ZH);
    expect(document.querySelector("a[href='mailto:hello@renocheck.homes']")).toBeTruthy();
    expect(document.querySelector("a[href='/login?next=/account']")).toBeNull();
  });

  it("does not add the closed-login sentence when the flag is on", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    render(await AccountPage());
    expect(document.body.textContent).not.toContain(ACCOUNT_DELETE_CLOSED_ZH);
    expect(document.querySelector("a[href='/login?next=/account']")).toBeTruthy();
  });

  it("puts the upload action above a de-emphasised delete zone when signed in", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://quote.example.invalid");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "test-not-a-key");
    vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "quote-dep");
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "person@example.com",
    });
    render(await AccountPage());
    const upload = screen.getByRole("link", { name: ACCOUNT_UPLOAD_ACTION_ZH });
    expect(upload.getAttribute("href")).toBe("/quote/upload");
    const danger = screen.getByRole("heading", { name: ACCOUNT_DELETE_HEADING_ZH });
    expect(danger.className).toContain("text-muted-foreground");
    expect(upload.compareDocumentPosition(danger) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.queryByRole("link", { name: ACCOUNT_UPLOAD_ACTION_ZH })).toBeTruthy();
  });

  it("hides the upload action when analysis is not configured", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "person@example.com",
    });
    render(await AccountPage());
    expect(screen.queryByRole("link", { name: ACCOUNT_UPLOAD_ACTION_ZH })).toBeNull();
    expect(screen.getByRole("heading", { name: ACCOUNT_DELETE_HEADING_ZH })).toBeTruthy();
  });
});
