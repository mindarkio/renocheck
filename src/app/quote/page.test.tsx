// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QUOTE_GUIDE_CTA_ZH, QUOTE_PAGE_TITLE_ZH } from "@/lib/quote-selfcheck";
import QuotePage from "./page";

afterEach(() => {
  cleanup();
});

describe("/quote guide", () => {
  it("is a static article with an upload link and no interactive checklist", () => {
    render(<QuotePage />);
    expect(screen.getByRole("heading", { level: 1, name: QUOTE_PAGE_TITLE_ZH })).toBeTruthy();
    const ctas = screen.getAllByRole("link", { name: QUOTE_GUIDE_CTA_ZH });
    expect(ctas.length).toBeGreaterThan(0);
    for (const link of ctas) expect(link.getAttribute("href")).toBe("/quote/upload");
    expect(screen.queryByRole("button", { name: "複製訊息" })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(document.body.textContent).not.toContain("報價自查清單");
  });
});
