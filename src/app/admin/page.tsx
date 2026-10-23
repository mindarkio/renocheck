import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminDashboardView } from "@/lib/admin/dashboard-view";
import { isAdminDashboardEnabled } from "@/lib/admin/auth";
import { isAdminSessionValid } from "@/lib/admin/session";
import { fetchGeminiUsageCard } from "@/lib/admin/gemini-usage-view";
import {
  fetchSearchAnalytics,
  parseAnalyticsDays,
  type SearchAnalyticsView,
} from "@/lib/admin/search-analytics";
import { fetchReturnAnalytics } from "@/lib/admin/return-analytics";
import { connection } from "next/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "搜尋數據",
};

function parseView(raw: string | undefined): SearchAnalyticsView {
  const allowed: SearchAnalyticsView[] = [
    "all",
    "none",
    "cr_matched",
    "ambiguous",
    "mwc_authoritative",
    "short",
  ];
  if (raw && allowed.includes(raw as SearchAnalyticsView)) {
    return raw as SearchAnalyticsView;
  }
  return "all";
}

type PageProps = {
  searchParams: Promise<{ days?: string; view?: string }>;
};

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  await connection();
  if (!isAdminDashboardEnabled()) notFound();
  if (!(await isAdminSessionValid())) redirect("/admin/login");

  const params = await searchParams;
  const days = parseAnalyticsDays(params.days);
  const view = parseView(params.view);

  const [result, gemini, returns] = await Promise.all([
    fetchSearchAnalytics(days),
    fetchGeminiUsageCard(),
    fetchReturnAnalytics(days),
  ]);
  if (!result.ok) {
    return (
      <AdminDashboardView
        data={emptyAggregate()}
        days={days}
        view={view}
        errorMessage="讀取數據出錯，請遲啲再試"
        gemini={gemini}
        returns={returns}
      />
    );
  }

  return (
    <AdminDashboardView
      data={result.data}
      days={days}
      view={view}
      gemini={gemini}
      returns={returns}
    />
  );
}

function emptyAggregate() {
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
      byInputType: {
        company_name: 0,
        phone: 0,
        br: 0,
        unknown: 0,
      },
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
    daily: [],
    truncated: false,
  };
}
