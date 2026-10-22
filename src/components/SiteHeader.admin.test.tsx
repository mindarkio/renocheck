// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let mockPath = "/admin";
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => mockPath),
}));

beforeAll(() => {
  // BrandMenuMark reads prefers-reduced-motion; jsdom has no matchMedia.
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

afterEach(() => cleanup());

describe("SiteHeader on /admin", () => {
  it.each(["/admin", "/admin/", "/admin/login", "/admin/x/y"])(
    "does not render on %s",
    async (p) => {
      mockPath = p;
      const { SiteHeader } = await import("@/components/SiteHeader");
      const { container } = render(<SiteHeader />);
      expect(container.innerHTML).toBe("");
    },
  );

  it.each(["/", "/faq", "/report/abc", "/administrator", "/admin-foo", "/adminx"])(
    "still renders on public path %s",
    async (p) => {
      mockPath = p;
      const { SiteHeader } = await import("@/components/SiteHeader");
      const { container } = render(<SiteHeader />);
      expect(container.querySelector('nav[aria-label="頁首"]')).not.toBeNull();
    },
  );
});
