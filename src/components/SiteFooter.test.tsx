// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_DISAMBIGUATION_LINE } from "@/lib/constants";
import { QUOTE_PAGE_NAV_LABEL_ZH } from "@/lib/quote-selfcheck";
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
    const link = screen.getByRole("link", { name: QUOTE_PAGE_NAV_LABEL_ZH });
    expect(link.getAttribute("href")).toBe("/quote");
    expect(link.textContent).toBe(QUOTE_PAGE_NAV_LABEL_ZH);
    expect(link.className).toContain("min-h-11");
    expect(link.className).toContain("focus-visible:ring-2");
    expect(link.className).toContain("focus-visible:ring-white");
    expect(link.className).not.toContain("ring-white/40");
    expect(document.querySelector("footer")?.className).toContain("focus-on-primary");
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("sets aria-current on /quote and leaves the disclaimer link in place", () => {
    mockPath = "/quote";
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: QUOTE_PAGE_NAV_LABEL_ZH }).getAttribute("aria-current")).toBe(
      "page",
    );
    const disclaimer = screen.getByRole("link", { name: "免責聲明" });
    expect(disclaimer.getAttribute("href")).toBe("/legal/disclaimer");
    expect(disclaimer.getAttribute("aria-current")).toBeNull();
  });

  it("shows the HK/UK disambiguation line as plain text", () => {
    const { container } = render(<SiteFooter />);
    const line = screen.getByText(SITE_DISAMBIGUATION_LINE);
    expect(line.tagName).toBe("P");
    expect(line.closest("a")).toBeNull();
    for (const anchor of container.querySelectorAll("a")) {
      expect(anchor.getAttribute("href") ?? "").not.toMatch(/renocheck\.co\.uk/i);
      expect(anchor.textContent ?? "").not.toContain("renocheck.co.uk");
    }
  });
});
