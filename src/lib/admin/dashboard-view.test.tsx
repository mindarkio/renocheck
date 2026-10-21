// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminDashboardView } from "@/lib/admin/dashboard-view";
import type { SearchAnalyticsAggregate } from "@/lib/admin/search-analytics";

const SENTINEL = "SENTINEL_TERM_MUST_NOT_RENDER";
const PHONE_DIGITS = "99990001";

function fixture(): SearchAnalyticsAggregate {
  return {
    kpi: {
      totalSearches: 3,
      cacheHitPct: 33.3,
      cacheHitCount: 1,
      noMatchPct: 50,
      noMatchCount: 1,
      ambiguousPct: 0,
      ambiguousCount: 0,
      byInputType: { company_name: 2, phone: 1, br: 0, unknown: 0 },
      missingCacheRow: 0,
    },
    terms: [
      {
        term: "測試裝修有限公司",
        length: 8,
        searches: 2,
        cacheHits: 1,
        outcome: "match",
        matchedName: "測試裝修有限公司",
        lastSeen: "2026-06-15T08:00:00.000Z",
      },
    ],
    views: {
      all: [
        {
          term: "測試裝修有限公司",
          length: 8,
          searches: 2,
          cacheHits: 1,
          outcome: "match",
          matchedName: "測試裝修有限公司",
          lastSeen: "2026-06-15T08:00:00.000Z",
        },
      ],
      none: [],
      ambiguous: [],
      mwc_authoritative: [],
      short: [],
    },
    daily: [{ day: "2026-06-15", searches: 3, cacheHitPct: 33.3 }],
    truncated: false,
  };
}

describe("AdminDashboardView", () => {
  it("renders company terms without phone sentinel or digits in HTML", () => {
    const { container } = render(
      <AdminDashboardView data={fixture()} days={30} view="all" />,
    );
    const html = container.innerHTML;
    expect(html).toContain("測試裝修有限公司");
    expect(html).not.toContain(SENTINEL);
    expect(html).not.toContain(PHONE_DIGITS);
  });
});
