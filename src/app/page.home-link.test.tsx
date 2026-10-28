// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOME_QUOTE_UPLOAD_LINK_ZH } from "@/lib/quote-analysis/copy";
import { QUOTE_PAGE_TITLE_ZH } from "@/lib/quote-selfcheck";

const open = vi.hoisted(() => vi.fn(async () => false));

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/lib/landing-public-stats", () => ({
  getLandingPublicStats: vi.fn(async () => null),
}));
vi.mock("@/lib/quote-analysis/availability", () => ({
  isQuoteUploadOpen: () => open(),
}));
vi.mock("@/lib/service-status", () => ({
  getServiceStatus: () => ({ paused: false }),
}));

import Home from "./page";
import { SiteFooter } from "@/components/SiteFooter";

describe("homepage quote link", () => {
  afterEach(() => {
    cleanup();
    open.mockReset();
  });

  it("shows the upload line only when analysis is available and omits the checklist link", async () => {
    open.mockResolvedValue(false);
    const closed = render(await Home());
    expect(screen.queryByRole("link", { name: HOME_QUOTE_UPLOAD_LINK_ZH })).toBeNull();
    expect(screen.queryByRole("link", { name: QUOTE_PAGE_TITLE_ZH })).toBeNull();
    closed.unmount();

    open.mockResolvedValue(true);
    render(await Home());
    const link = screen.getByRole("link", { name: HOME_QUOTE_UPLOAD_LINK_ZH });
    expect(link.getAttribute("href")).toBe("/quote/upload");
    expect(link.className).toContain("min-h-11");
    expect(screen.queryByRole("link", { name: QUOTE_PAGE_TITLE_ZH })).toBeNull();
  });

  it("keeps the checklist link in the footer", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: QUOTE_PAGE_TITLE_ZH }).getAttribute("href")).toBe(
      "/quote",
    );
  });
});
