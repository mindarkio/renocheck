// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUOTE_ACK_LABEL_ZH } from "@/lib/quote-analysis/copy";
import { QuoteAnalysisForm } from "./QuoteAnalysisForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("quote acknowledgement", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts unticked and does not upload until it is ticked", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<QuoteAnalysisForm signedIn />);
    const checkbox = screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(checkbox.hasAttribute("required")).toBe(true);
    const form = screen.getByRole("button", { name: "開始分析" }).closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("請先剔選");
  });
});
