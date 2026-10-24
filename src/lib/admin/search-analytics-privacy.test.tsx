// @vitest-environment jsdom
import { randomInt } from "node:crypto";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminDashboardView } from "@/lib/admin/dashboard-view";
import {
  aggregateSearchAnalytics,
  analyticsRangeStart,
  hkDayKey,
  maskAdminTerm,
  type SearchCacheAnalyticsRow,
  type SearchEventRow,
} from "@/lib/admin/search-analytics";

const SENTINEL = "SENTINEL_TERM_MUST_NOT_RENDER";
/** Generated at runtime; never committed. */
const digits8 = () => String(randomInt(20_000_000, 99_999_999));
const RENDER_NOW = "2026-06-15T12:00:00.000Z";

/** Every run of 4+ digits, sorted. The dashboard chrome prints dates such as 2026-06-15. */
function digitRuns(html: string): string[] {
  return (html.match(/\d{4,}/g) ?? []).sort();
}

afterEach(() => {
  cleanup();
});

describe("admin term privacy (PR #32 review)", () => {
  it("masks phone / BR digit runs, e-mail and HKID in company-name terms", () => {
    const d = digits8();
    const spaced = `${d.slice(0, 4)} ${d.slice(4)}`;
    const fullWidth = [...d].map((c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).join("");
    for (const raw of [`甲乙工程 ${d}`, `測試 ${spaced}`, `測試${fullWidth}`, `測試 a.b@example.com`, `測試 A123456(7)`]) {
      const masked = maskAdminTerm(raw);
      expect(masked).not.toMatch(/\d{4}/);
      expect(masked).not.toContain("@");
    }
    expect(maskAdminTerm("甲乙工程")).toBe("甲乙工程");
    expect(maskAdminTerm("AB 3D 設計")).toBe("AB 3D 設計");
    expect(maskAdminTerm("陳師傅")).toBe("陳師傅");
    expect(maskAdminTerm("李生")).toBe("李生");
  });

  it("render: phone/BR sentinel rows and digits typed into the name box never reach HTML", () => {
    const now = new Date(RENDER_NOW);
    const day = RENDER_NOW.slice(0, 10);
    const events: SearchEventRow[] = [
      { fingerprint: "fp-a", cache_hit: false, created_at: `${day}T08:00:00.000Z` },
      { fingerprint: "fp-p", cache_hit: true, created_at: `${day}T09:00:00.000Z` },
      { fingerprint: "fp-b", cache_hit: false, created_at: `${day}T10:00:00.000Z` },
    ];
    const cacheFor = (term: string): SearchCacheAnalyticsRow[] => [
      { fingerprint: "fp-a", term, match_type: "company_name", outcome: "user_only", matched_name: null },
      { fingerprint: "fp-p", term: SENTINEL, match_type: "phone", outcome: null, matched_name: SENTINEL },
      { fingerprint: "fp-b", term: SENTINEL, match_type: "br", outcome: null, matched_name: SENTINEL },
    ];
    const renderHtml = (term: string, view: "all" | "none" | "short") => {
      const data = aggregateSearchAnalytics(events, cacheFor(term), now, 7);
      const { container } = render(<AdminDashboardView data={data} days={7} view={view} />);
      const html = container.innerHTML;
      cleanup();
      return { html, data };
    };
    // A random number, plus one that starts with the fixture year (what a "skip dates" masker would miss).
    const yearLike = `${day.slice(0, 4)}${String(randomInt(1000, 10_000))}`;
    for (const d of [digits8(), yearLike]) {
      for (const view of ["all", "none", "short"] as const) {
        const { html, data } = renderHtml(`甲乙工程 ${d}`, view);
        // Same digits as a render of the already-masked term: no whole, prefix or suffix leak,
        // whatever year the fixture uses.
        const { html: baseline } = renderHtml("甲乙工程 [號碼]", view);
        expect(html).not.toContain(SENTINEL);
        expect(html).not.toContain(d);
        expect(digitRuns(html)).toEqual(digitRuns(baseline));
        if (view !== "short") expect(html).toContain("甲乙工程 [號碼]");
        expect(data.kpi.byInputType).toMatchObject({ phone: 1, br: 1, company_name: 1 });
      }
    }
  });

  it("range starts at HK midnight of the oldest day, so daily totals equal the KPI total", () => {
    const now = new Date("2026-03-10T15:00:00.000Z");
    const start = analyticsRangeStart(now, 7);
    expect(hkDayKey(start)).toBe(hkDayKey(new Date(now.getTime() - 6 * 86_400_000)));
    expect(start.toISOString()).toMatch(/T16:00:00\.000Z$/);
    const events: SearchEventRow[] = [
      { fingerprint: "x", cache_hit: false, created_at: start.toISOString() },
      { fingerprint: "x", cache_hit: true, created_at: now.toISOString() },
    ];
    const data = aggregateSearchAnalytics(events, [], now, 7);
    expect(data.daily).toHaveLength(7);
    expect(data.daily.reduce((s, r) => s + r.searches, 0)).toBe(data.kpi.totalSearches);
  });

  it("error state does not also claim there is no data", () => {
    const data = aggregateSearchAnalytics([], [], new Date(RENDER_NOW), 30);
    const { container } = render(
      <AdminDashboardView data={data} days={30} view="all" errorMessage="讀取數據出錯，請遲啲再試" />,
    );
    expect(container.textContent).toContain("讀取數據出錯");
    expect(container.textContent).not.toContain("呢段時間未有搜尋紀錄");
  });
});
