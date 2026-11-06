// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthUser } from "@/lib/supabase/server";
import {
  QUOTE_FILE_HINT_ZH,
  QUOTE_FILE_LABEL_ZH,
  QUOTE_PICK_FIRST_ZH,
  QUOTE_SIGN_IN_LINK_ZH,
  QUOTE_SUBMIT_ZH,
  QUOTE_UNAVAILABLE_ZH,
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

vi.mock("@/lib/usage-events-client", () => ({
  sendUsageEvent: vi.fn(),
}));

import { sendUsageEvent } from "@/lib/usage-events-client";
import QuoteUploadPage from "./page";

describe("quote upload page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("lets a logged-out visitor pick a PDF without a login redirect", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://quote.example.invalid");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "test-not-a-key");
    vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "quote-dep");
    vi.mocked(sendUsageEvent).mockClear();
    render(await QuoteUploadPage());
    expect(screen.getByLabelText(QUOTE_FILE_LABEL_ZH)).toBeTruthy();
    expect(screen.queryByRole("link", { name: QUOTE_SIGN_IN_LINK_ZH })).toBeNull();
    expect(vi.mocked(sendUsageEvent).mock.calls).toEqual([["quote_upload_open"]]);
  });

  function enableAnalysis() {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://quote.example.invalid");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "test-not-a-key");
    vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "quote-dep");
  }

  it("shows the pick-first note under the file picker when logged out", async () => {
    enableAnalysis();
    render(await QuoteUploadPage());
    const note = screen.getByText(QUOTE_PICK_FIRST_ZH);
    expect(note.tagName).toBe("P");
    expect(screen.getAllByText(QUOTE_PICK_FIRST_ZH)).toHaveLength(1);
    const input = screen.getByLabelText(QUOTE_FILE_LABEL_ZH);
    const describedBy = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(describedBy).toEqual(["quote-pdf-hint", note.id]);
    for (const id of describedBy) expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
    expect(document.getElementById("quote-pdf-hint")?.textContent?.trim()).toBe(QUOTE_FILE_HINT_ZH);
    expect(input.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the pick-first note when signed in too", async () => {
    enableAnalysis();
    vi.mocked(getAuthUser).mockResolvedValueOnce({ id: "u1", email: "a@example.invalid" } as never);
    render(await QuoteUploadPage());
    expect(screen.getByRole("button", { name: QUOTE_SUBMIT_ZH })).toBeTruthy();
    expect(screen.getAllByText(QUOTE_PICK_FIRST_ZH)).toHaveLength(1);
  });

  it("stays closed when analysis is not configured", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    vi.mocked(sendUsageEvent).mockClear();
    render(await QuoteUploadPage());
    expect(vi.mocked(sendUsageEvent).mock.calls).toEqual([["quote_upload_unavailable"]]);
    expect(screen.getByText(QUOTE_UNAVAILABLE_ZH)).toBeTruthy();
    expect(screen.queryByLabelText(QUOTE_FILE_LABEL_ZH)).toBeNull();
    expect(screen.queryByText(QUOTE_PICK_FIRST_ZH)).toBeNull();
  });
});
