// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/logout/actions", () => ({
  submitAdminLogout: vi.fn(),
}));
import { AdminDashboardView } from "@/lib/admin/dashboard-view";
import type { SearchAnalyticsAggregate } from "@/lib/admin/search-analytics";

function emptyData(): SearchAnalyticsAggregate {
  return {
    kpi: {
      totalSearches: 0,
      cacheHitPct: 0,
      cacheHitCount: 0,
      noMatchPct: 0,
      noMatchCount: 0,
      ambiguousPct: 0,
      ambiguousCount: 0,
      byInputType: { company_name: 0, phone: 0, br: 0, unknown: 0 },
      missingCacheRow: 0,
    },
    terms: [],
    views: { all: [], none: [], ambiguous: [], mwc_authoritative: [], short: [] },
    daily: Array.from({ length: 7 }, (_, i) => ({
      day: `2026-06-${String(i + 1).padStart(2, "0")}`,
      searches: 0,
      cacheHitPct: 0,
    })),
    truncated: false,
  };
}

describe("AdminDashboardView UI (YUI)", () => {
  afterEach(() => cleanup());
  it("marks selected day and view tabs with aria-current=page", () => {
    render(<AdminDashboardView data={emptyData()} days={30} view="none" />);
    const day30 = screen.getByRole("link", { name: "30 日" });
    const tabNone = screen.getByRole("link", { name: "搵唔到" });
    expect(day30.getAttribute("aria-current")).toBe("page");
    expect(tabNone.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "7 日" }).getAttribute("aria-current")).toBeNull();
  });

  it("hides daily chart when daily total is zero", () => {
    const { container } = render(
      <AdminDashboardView data={emptyData()} days={7} view="all" />,
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toContain("呢段時間未有搜尋紀錄");
  });

  it("hides daily section entirely on error", () => {
    const { container } = render(
      <AdminDashboardView
        data={emptyData()}
        days={30}
        view="all"
        errorMessage="讀取數據出錯，請遲啲再試"
      />,
    );
    expect(container.textContent).not.toContain("每日搜尋量");
  });
});
