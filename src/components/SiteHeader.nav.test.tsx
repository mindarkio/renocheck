// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ACCOUNT_DELETE_HEADING_ZH, HEADER_UPLOAD_ZH } from "@/lib/quote-analysis/copy";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ enabled: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
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
    expect(mobile?.className).toContain("focus-visible:ring-offset-2");
    expect(mobile?.className).not.toContain("ring-white/50");
    expect(dialog.className).toContain("focus-on-primary");
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

describe("SiteHeader mobile menu lifecycle (PR #43 review)", () => {
  it("does not steal focus on first paint", () => {
    const outside = document.createElement("button");
    outside.textContent = "頁面內容";
    document.body.appendChild(outside);
    outside.focus();
    render(<SiteHeader />);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("makes the page behind the sheet inert and releases it, focus and Tab after close", () => {
    const main = document.createElement("main");
    const outside = document.createElement("button");
    outside.textContent = "頁面內容";
    main.appendChild(outside);
    document.body.appendChild(main);
    render(<SiteHeader />);
    const closeButton = openMenu();
    expect(main.hasAttribute("inert")).toBe(true);
    const dialog = screen.getByRole("dialog", { name: "網站選單" });
    expect(dialog.closest("[inert]")).toBeNull();
    expect(closeButton.closest("[inert]")).toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBeNull();
    const tabWhileOpen = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    closeButton.dispatchEvent(tabWhileOpen);
    // The trap moves focus itself, so the browser must not move it a second time.
    expect(tabWhileOpen.defaultPrevented).toBe(true);

    fireEvent.click(closeButton);
    expect(main.hasAttribute("inert")).toBe(false);
    outside.focus();
    expect(document.activeElement).toBe(outside);
    const tabAfterClose = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    outside.dispatchEvent(tabAfterClose);
    expect(tabAfterClose.defaultPrevented).toBe(false);
    main.remove();
  });

  it("closes and unlocks scroll when the route changes while open", () => {
    mockPath = "/faq";
    const { rerender } = render(<SiteHeader />);
    openMenu();
    expect(document.body.style.overflow).toBe("hidden");
    mockPath = "/quote";
    rerender(<SiteHeader />);
    expect(screen.queryByRole("dialog", { name: "網站選單" })).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(screen.getByRole("button", { name: "開啟選單" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when the viewport reaches the sm breakpoint", () => {
    const listeners = new Set<() => void>();
    const mql = {
      matches: false,
      media: "(min-width: 40rem)",
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      query === mql.media ? mql : original(query)) as unknown as typeof window.matchMedia;
    try {
      render(<SiteHeader />);
      openMenu();
      expect(listeners.size).toBe(1);
      mql.matches = true;
      act(() => listeners.forEach((fn) => fn()));
      expect(screen.queryByRole("dialog", { name: "網站選單" })).toBeNull();
      expect(document.body.style.overflow).toBe("");
      expect(listeners.size).toBe(0);
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("SiteHeader upload link", () => {
  it("adds an upload link when analysis is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ enabled: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    render(<SiteHeader />);
    const link = await screen.findByRole("link", { name: HEADER_UPLOAD_ZH });
    expect(link.getAttribute("href")).toBe("/quote/upload");
    expect(link.className).toContain("hidden");
    expect(link.className).toContain("lg:inline-flex");
    openMenu();
    const mobile = dialogLinks().find((anchor) => anchor.getAttribute("href") === "/quote/upload");
    expect(mobile?.textContent).toBe(HEADER_UPLOAD_ZH);
    expect(dialogLinks()).toHaveLength(7);
    expect(screen.queryByRole("link", { name: ACCOUNT_DELETE_HEADING_ZH })).toBeNull();
  });

  it("shows delete-account in the menu only when signed in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        new Response(
          JSON.stringify(
            String(url).includes("/api/auth/session")
              ? { signedIn: true }
              : { enabled: false },
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    render(<SiteHeader />);
    const link = await screen.findByRole("link", { name: ACCOUNT_DELETE_HEADING_ZH });
    expect(link.getAttribute("href")).toBe("/account/delete");
    openMenu();
    expect(
      dialogLinks().some((anchor) => anchor.getAttribute("href") === "/account/delete"),
    ).toBe(true);
  });
});
