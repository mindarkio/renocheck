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
      crMatchedPct: 0,
      crMatchedCount: 0,
      ambiguousPct: 0,
      ambiguousCount: 0,
      byInputType: { company_name: 0, phone: 0, br: 0, unknown: 0 },
      missingCacheRow: 0,
    },
    terms: [],
    views: {
      all: [],
      none: [],
      cr_matched: [],
      ambiguous: [],
      mwc_authoritative: [],
      short: [],
    },
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
    expect(screen.getByRole("link", { name: "公司註冊處搵到" })).toBeTruthy();
    expect(screen.getAllByText("公司註冊處搵到").length).toBeGreaterThanOrEqual(2);
    expect(day30.getAttribute("aria-current")).toBe("page");
    expect(tabNone.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "7 日" }).getAttribute("aria-current")).toBeNull();
  });

  it("shows returning-user counts and the undercount note", () => {
    const { container } = render(
      <AdminDashboardView
        data={emptyData()}
        days={7}
        view="all"
        returns={{
          weeks: [{ weekStart: "2026-06-15", newDevices: 2, returningDevices: 1 }],
          intervals: { within1Day: 3, within7Days: 1, within30Days: 0, over30Days: 4 },
          returnerActions: { sameCompany: 1, differentCompany: 2, usedQuote: 1 },
          funnel: {
            quotePage: 5,
            quoteAllTicked: 1,
            quoteCopyReply: 2,
            reportOfficialLink: 4,
            reportShare: 1,
          },
          truncated: false,
          searchAnon: "pending",
          usageEvents: "ready",
          readError: false,
        }}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("呢啲數字會少計");
    expect(text).toContain("WhatsApp／IG");
    expect(text).toContain("資料庫變更尚未套用");
    expect(text).toContain("2026-06-15");
    expect(text).toContain("再搜同一間公司");
    expect(text).toContain("20 項都揀咗");
    expect(text).not.toContain("SENTINEL");
  });

  it("shows empty states for table and daily (heading kept) with genuine zero KPIs", () => {
    const { container } = render(
      <AdminDashboardView data={emptyData()} days={7} view="all" />,
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByRole("heading", { name: "每日搜尋量" })).toBeTruthy();
    expect(container.textContent?.match(/呢段時間未有搜尋紀錄/g)?.length).toBe(2);
    expect(container.textContent).toContain("總搜尋次數");
    expect(container.textContent).toMatch(/總搜尋次數0快取命中/);
    expect(container.textContent).toMatch(/快取命中0%/);
  });

  it("shows em dash KPIs when analytics failed", () => {
    const { container } = render(
      <AdminDashboardView
        data={emptyData()}
        days={30}
        view="all"
        errorMessage="讀取數據出錯，請遲啲再試"
      />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/0%/);
    expect(text).not.toContain("0 次");
    expect(text).toContain("按類型：公司名 —未能讀取・電話 —未能讀取・BR —未能讀取");
    expect(text).not.toContain("呢啲數字會少計");
    // 5 KPI cards + 3 input types; each dash is aria-hidden with an sr-only label.
    expect(screen.getAllByText("未能讀取")).toHaveLength(8);
    const dashes = [...container.querySelectorAll("span")].filter((s) => s.textContent === "—");
    expect(dashes).toHaveLength(8);
    for (const d of dashes) expect(d.getAttribute("aria-hidden")).toBe("true");
  });

  it("never shows stale or partial numbers when analytics failed", () => {
    const data = emptyData();
    data.kpi = {
      ...data.kpi,
      totalSearches: 987,
      cacheHitPct: 12.5,
      cacheHitCount: 123,
      noMatchPct: 25,
      noMatchCount: 246,
      ambiguousPct: 5,
      ambiguousCount: 49,
      byInputType: { company_name: 700, phone: 200, br: 87, unknown: 3 },
      missingCacheRow: 4,
    };
    const { container } = render(
      <AdminDashboardView
        data={data}
        days={30}
        view="all"
        errorMessage="讀取數據出錯，請遲啲再試"
      />,
    );
    const text = container.textContent ?? "";
    for (const n of ["987", "12.5", "123", "246", "49", "700", "200", "87", "未知", "搵唔返報告紀錄"]) {
      expect(text).not.toContain(n);
    }
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
