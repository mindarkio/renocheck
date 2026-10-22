// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUOTE_PAGE_TITLE_ZH } from "@/lib/quote-selfcheck";
import { SiteFooter } from "./SiteFooter";

let mockPath = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
}));

afterEach(() => {
  cleanup();
  mockPath = "/";
});

describe("SiteFooter quote link", () => {
  it("uses the quote page title with a 44px target", () => {
    mockPath = "/faq";
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: QUOTE_PAGE_TITLE_ZH });
    expect(link.getAttribute("href")).toBe("/quote");
    expect(link.textContent).toBe(QUOTE_PAGE_TITLE_ZH);
    expect(link.className).toContain("min-h-11");
    expect(link.className).toContain("focus-visible:ring-2");
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("sets aria-current on /quote and leaves the disclaimer link in place", () => {
    mockPath = "/quote";
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: QUOTE_PAGE_TITLE_ZH }).getAttribute("aria-current")).toBe(
      "page",
    );
    const disclaimer = screen.getByRole("link", { name: "免責聲明" });
    expect(disclaimer.getAttribute("href")).toBe("/legal/disclaimer");
    expect(disclaimer.getAttribute("aria-current")).toBeNull();
  });
});
