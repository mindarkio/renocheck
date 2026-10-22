// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { QUOTE_PAGE_TITLE_ZH } from "@/lib/quote-selfcheck";
import { SiteHeader } from "./SiteHeader";

let mockPath = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
}));

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  mockPath = "/";
});

function quoteLinks() {
  return screen.getAllByRole("link", { name: QUOTE_PAGE_TITLE_ZH });
}

describe("SiteHeader quote link", () => {
  it("uses the quote page title and keeps the mobile menu button", () => {
    mockPath = "/faq";
    render(<SiteHeader />);
    const link = quoteLinks()[0];
    expect(link.getAttribute("href")).toBe("/quote");
    expect(link.textContent).toBe(QUOTE_PAGE_TITLE_ZH);
    expect(link.className).toContain("min-h-11");
    expect(link.className).toContain("focus-visible:ring-2");
    expect(link.className).toContain("whitespace-nowrap");
    expect(link.getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("button", { name: "開啟選單" })).toBeTruthy();
  });

  it("marks /quote current in the desktop row and the mobile menu", () => {
    mockPath = "/quote";
    render(<SiteHeader />);
    const desktop = quoteLinks()[0];
    expect(desktop.getAttribute("aria-current")).toBe("page");

    fireEvent.click(screen.getByRole("button", { name: "開啟選單" }));
    const dialog = screen.getByRole("dialog", { name: "網站選單" });
    const mobile = [...dialog.querySelectorAll("a")].find(
      (anchor) => anchor.getAttribute("href") === "/quote",
    );
    expect(mobile?.textContent).toBe(QUOTE_PAGE_TITLE_ZH);
    expect(mobile?.getAttribute("aria-current")).toBe("page");
    expect(mobile?.className).toContain("min-h-12");
    expect(screen.getByRole("button", { name: "關閉選單" })).toBeTruthy();
  });
});
