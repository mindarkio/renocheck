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

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "開啟選單" }));
  return screen.getByRole("button", { name: "關閉選單" });
}

function dialogLinks(): HTMLAnchorElement[] {
  const dialog = screen.getByRole("dialog", { name: "網站選單" });
  return [...dialog.querySelectorAll("a")];
}

function tab(shiftKey = false) {
  const target =
    document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  fireEvent.keyDown(target, { key: "Tab", shiftKey });
}

const STRONG_HEADER_RING = [
  "focus-visible:ring-2",
  "focus-visible:ring-primary",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-offset-background",
];

describe("SiteHeader quote link", () => {
  it("uses the quote page title and keeps the mobile menu button", () => {
    mockPath = "/faq";
    render(<SiteHeader />);
    const link = quoteLinks()[0];
    expect(link.getAttribute("href")).toBe("/quote");
    expect(link.textContent).toBe(QUOTE_PAGE_TITLE_ZH);
    expect(link.className).toContain("min-h-11");
    for (const token of STRONG_HEADER_RING) expect(link.className).toContain(token);
    expect(link.className).not.toContain("ring-primary/30");
    expect(link.className).toContain("whitespace-nowrap");
    const logo = screen.getByTestId("site-header-logo");
    for (const token of STRONG_HEADER_RING) expect(logo.className).toContain(token);
    expect(logo.className).not.toContain("ring-primary/30");
    const menuButton = screen.getByRole("button", { name: "開啟選單" });
    for (const token of STRONG_HEADER_RING) expect(menuButton.className).toContain(token);
    expect(menuButton.className).not.toContain("ring-primary/30");
    expect(link.getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("button", { name: "開啟選單" })).toBeTruthy();
  });

  it("marks /quote current in the desktop row and the mobile menu", () => {
    mockPath = "/quote";
    render(<SiteHeader />);
    const desktop = quoteLinks()[0];
    expect(desktop.getAttribute("aria-current")).toBe("page");

    openMenu();
    const dialog = screen.getByRole("dialog", { name: "網站選單" });
    const mobile = [...dialog.querySelectorAll("a")].find(
      (anchor) => anchor.getAttribute("href") === "/quote",
    );
    expect(mobile?.textContent).toBe(QUOTE_PAGE_TITLE_ZH);
    expect(mobile?.getAttribute("aria-current")).toBe("page");
    expect(mobile?.className).toContain("min-h-12");
    expect(mobile?.className).toContain("focus-visible:ring-white");
    expect(mobile?.className).not.toContain("ring-white/50");
    expect(screen.getByRole("button", { name: "關閉選單" })).toBeTruthy();
  });
});

describe("SiteHeader mobile menu focus", () => {
  it("keeps Tab inside the dialog and returns focus to the menu button", () => {
    const outside = document.createElement("button");
    outside.type = "button";
    outside.textContent = "頁面內容";
    document.body.appendChild(outside);

    render(<SiteHeader />);
    const closeButton = openMenu();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(closeButton);

    const links = dialogLinks();
    expect(links).toHaveLength(6);
    expect(links.some((anchor) => anchor.textContent === QUOTE_PAGE_TITLE_ZH)).toBe(true);

    tab();
    expect(document.activeElement).toBe(links[0]);
    for (let i = 1; i < links.length; i += 1) {
      tab();
      expect(document.activeElement).toBe(links[i]);
    }
    tab();
    expect(document.activeElement).toBe(closeButton);
    expect(document.activeElement).not.toBe(outside);

    tab(true);
    expect(document.activeElement).toBe(links.at(-1));
    tab(true);
    expect(document.activeElement).toBe(links.at(-2));

    outside.focus();
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(closeButton, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "網站選單" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "開啟選單" }));

    outside.remove();
  });

  it("returns focus when a menu link or the close button dismisses the sheet", () => {
    render(<SiteHeader />);
    openMenu();
    const quote = dialogLinks().find((anchor) => anchor.getAttribute("href") === "/quote");
    expect(quote?.textContent).toBe(QUOTE_PAGE_TITLE_ZH);
    quote?.focus();
    // jsdom logs "navigation to another Document" if the anchor's default action runs.
    quote?.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(quote!);
    expect(screen.queryByRole("dialog", { name: "網站選單" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "開啟選單" }));

    const closeButton = openMenu();
    dialogLinks()[0]?.focus();
    fireEvent.click(closeButton);
    expect(screen.queryByRole("dialog", { name: "網站選單" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "開啟選單" }));
  });
});
