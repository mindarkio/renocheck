// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOME_QUOTE_UPLOAD_LINK_ZH } from "@/lib/quote-analysis/copy";
import { formatMwcRegistryUpdatedAt } from "@/lib/landing-public-stats";
import { QUOTE_PAGE_NAV_LABEL_ZH, QUOTE_PAGE_TITLE_ZH } from "@/lib/quote-selfcheck";

const { open, STATS } = vi.hoisted(() => ({
  open: vi.fn(async () => false),
  STATS: {
    mwcContractorCount: 8123,
    mwcSourceUpdatedAt: "2026-01-15T00:00:00.000Z",
  },
}));

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/lib/landing-public-stats", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/landing-public-stats")>();
  return {
    ...actual,
    getLandingPublicStats: vi.fn(async () => STATS),
  };
});
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
    expect(screen.queryByRole("link", { name: QUOTE_PAGE_NAV_LABEL_ZH })).toBeNull();
    expect(screen.getByText("8,123")).toBeTruthy();
    expect(screen.getByText(/條屋宇署 MWC 小型工程承辦商公開登記/)).toBeTruthy();
    expect(
      screen.getByText(`名冊資料截至 ${formatMwcRegistryUpdatedAt(STATS.mwcSourceUpdatedAt)}`),
    ).toBeTruthy();
  });

  it("keeps the quote guide link in the footer beside the guides link", () => {
    render(<SiteFooter />);
    const guide = screen.getByRole("link", { name: QUOTE_PAGE_NAV_LABEL_ZH });
    expect(guide.getAttribute("href")).toBe("/quote");
    const labels = screen.getAllByRole("link").map((link) => link.textContent);
    const guidesAt = labels.indexOf("裝修指南");
    expect(labels[guidesAt + 1]).toBe(QUOTE_PAGE_NAV_LABEL_ZH);
  });
});
