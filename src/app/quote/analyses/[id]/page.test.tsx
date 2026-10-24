// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUOTE_RESULT_MISSING_ZH, QUOTE_UNAVAILABLE_ZH } from "@/lib/quote-analysis/copy";

const auth = vi.hoisted(() => ({
  getAuthUser: vi.fn(async () => null),
  createSupabaseServerClient: vi.fn(async () => null),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: () => auth.getAuthUser(),
  createSupabaseServerClient: () => auth.createSupabaseServerClient(),
}));

import QuoteAnalysisResultPage from "./page";

const ID = "22222222-2222-4222-8222-222222222222";

describe("quote result page flag", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    auth.getAuthUser.mockClear();
    auth.createSupabaseServerClient.mockClear();
  });

  it("shows the closed state and does not read the row when the flag is off", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    render(await QuoteAnalysisResultPage({ params: Promise.resolve({ id: ID }) }));
    expect(screen.getByText(QUOTE_UNAVAILABLE_ZH)).toBeTruthy();
    expect(document.body.textContent).not.toContain(QUOTE_RESULT_MISSING_ZH);
    expect(auth.getAuthUser).not.toHaveBeenCalled();
    expect(auth.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("keeps the owner lookup when the flag is on", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    render(await QuoteAnalysisResultPage({ params: Promise.resolve({ id: ID }) }));
    expect(screen.getByText(QUOTE_RESULT_MISSING_ZH)).toBeTruthy();
    expect(document.body.textContent).not.toContain(QUOTE_UNAVAILABLE_ZH);
    expect(auth.getAuthUser).toHaveBeenCalledOnce();
  });
});
