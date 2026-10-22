// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminDashboardView } from "@/lib/admin/dashboard-view";
import type { GeminiUsageCardData } from "@/lib/admin/gemini-usage-view";
import type { SearchAnalyticsAggregate } from "@/lib/admin/search-analytics";

const B4 = "過去 24 小時撞過 Gemini 上限，用戶可能搜唔到";
const GATEWAY = "而家用緊 AI Gateway，唔係 Gemini。";

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
    daily: [],
    truncated: false,
  };
}

function card(overrides: Partial<GeminiUsageCardData> = {}): GeminiUsageCardData {
  return {
    providerLabel: "google/gemini-3.5-flash",
    providerKind: "google",
    usedToday: 2,
    rpdLimit: null,
    rpmLimit: null,
    http429: 0,
    quotaDay: 0,
    rateMinute: 0,
    server5xx: 0,
    last429At: null,
    lastQuotaValue: 20,
    nextReset: "2026-11-01T07:00:00.000Z",
    warning: false,
    ...overrides,
  };
}

afterEach(() => cleanup());

function section() {
  const node = document.querySelector('[aria-label="AI 用量（Gemini）"]');
  if (!node) throw new Error("missing gemini section");
  return within(node as HTMLElement);
}

describe("AI 用量（Gemini） card", () => {
  it("shows the warning and 未設定 when limits are null", () => {
    render(
      <AdminDashboardView
        data={emptyData()}
        days={7}
        view="all"
        gemini={{ ok: true, data: card({ warning: true, quotaDay: 1, http429: 1 }) }}
      />,
    );
    const view = section();
    expect(view.getByRole("alert").textContent).toBe(B4);
    expect(view.getByText("2 / 未設定")).toBeTruthy();
    expect(view.getAllByText("未設定").length).toBeGreaterThanOrEqual(2);
    expect(view.queryByText(GATEWAY)).toBeNull();
    expect(view.getByText("google/gemini-3.5-flash")).toBeTruthy();
    expect(document.body.textContent).not.toContain("2 / 20");
  });

  it("hides the warning when the threshold was not crossed", () => {
    render(
      <AdminDashboardView
        data={emptyData()}
        days={7}
        view="all"
        gemini={{ ok: true, data: card({ warning: false, rpdLimit: 4, rpmLimit: 2 }) }}
      />,
    );
    const view = section();
    expect(view.queryByRole("alert")).toBeNull();
    expect(view.getByText("2 / 4")).toBeTruthy();
    expect(view.getByText("4")).toBeTruthy();
    expect(view.getByText("2")).toBeTruthy();
    expect(document.querySelector('[aria-label="AI 用量（Gemini）"]')?.textContent).toContain(
      "15:00",
    );
  });

  it("shows an em dash and a screen-reader failure label in the error state", () => {
    render(
      <AdminDashboardView
        data={emptyData()}
        days={7}
        view="all"
        gemini={{ ok: false }}
      />,
    );
    const view = section();
    expect(view.getAllByText("未能讀取")).toHaveLength(9);
    const dashes = [...view.getByRole("heading", { name: "AI 用量（Gemini）" }).parentElement!.querySelectorAll("span")].filter(
      (s) => s.textContent === "—",
    );
    expect(dashes).toHaveLength(9);
    for (const dash of dashes) expect(dash.getAttribute("aria-hidden")).toBe("true");
    expect(view.queryByText("未設定")).toBeNull();
    expect(view.queryByText(GATEWAY)).toBeNull();
    expect(view.getByRole("heading").parentElement?.textContent).not.toMatch(/今日已用0/);
  });

  it("shows the gateway note only when the provider is the gateway", () => {
    const { unmount } = render(
      <AdminDashboardView
        data={emptyData()}
        days={7}
        view="all"
        gemini={{
          ok: true,
          data: card({
            providerKind: "gateway",
            providerLabel: "gateway/openai/gpt-4o-mini",
          }),
        }}
      />,
    );
    expect(screen.getByText(GATEWAY)).toBeTruthy();
    unmount();
    render(
      <AdminDashboardView
        data={emptyData()}
        days={7}
        view="all"
        gemini={{ ok: true, data: card({ providerKind: "google" }) }}
      />,
    );
    expect(screen.queryByText(GATEWAY)).toBeNull();
  });
});
