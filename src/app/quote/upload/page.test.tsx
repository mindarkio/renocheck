// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QUOTE_FILE_LABEL_ZH,
  QUOTE_SIGN_IN_LINK_ZH,
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
    render(await QuoteUploadPage());
    expect(screen.getByLabelText(QUOTE_FILE_LABEL_ZH)).toBeTruthy();
    expect(screen.queryByRole("link", { name: QUOTE_SIGN_IN_LINK_ZH })).toBeNull();
  });

  it("stays closed when analysis is not configured", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    render(await QuoteUploadPage());
    expect(screen.getByText(QUOTE_UNAVAILABLE_ZH)).toBeTruthy();
    expect(screen.queryByLabelText(QUOTE_FILE_LABEL_ZH)).toBeNull();
  });
});
