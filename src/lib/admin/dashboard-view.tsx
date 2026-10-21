import Link from "next/link";
import { submitAdminLogout } from "@/app/admin/logout/actions";
import { outcomeLabelZh } from "@/lib/admin/outcome-labels";
import {
  formatHkDateTime,
  type AnalyticsDays,
  type SearchAnalyticsAggregate,
  type SearchAnalyticsView,
  type TermRow,
} from "@/lib/admin/search-analytics";

const VIEW_TABS: { id: SearchAnalyticsView; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "none", label: "搵唔到" },
  { id: "ambiguous", label: "撞名多間" },
  { id: "mwc_authoritative", label: "名唔同但搵到" },
  { id: "short", label: "太短（4 個字或以下）" },
];

const SELECTED_LINK =
  "rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground";
const UNSELECTED_LINK =
  "rounded-full border border-border bg-card px-3 py-1 text-sm";

type Props = {
  data: SearchAnalyticsAggregate;
  days: AnalyticsDays;
  view: SearchAnalyticsView;
  errorMessage?: string | null;
};

export function AdminDashboardView({ data, days, view, errorMessage }: Props) {
  const rows = data.views[view] ?? data.terms;
  const dailyTotal = data.daily.reduce((sum, d) => sum + d.searches, 0);
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.searches));

  return (
    <div className="mx-auto min-h-screen max-w-5xl space-y-8 px-4 py-6 text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-primary">搜尋數據</h1>
        <form action={submitAdminLogout}>
          <button
            type="submit"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium"
          >
            登出
          </button>
        </form>
      </header>

      {errorMessage ? (
        <div
          className="rounded-md border border-warning bg-warning-foreground px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      {data.truncated ? (
        <p className="text-sm text-muted-foreground">
          數據太多，只計咗最近 50,000 次
        </p>
      ) : null}

      <nav className="flex flex-wrap gap-2" aria-label="日期範圍">
        {([7, 30, 90] as AnalyticsDays[]).map((d) => (
          <Link
            key={d}
            prefetch={false}
            href={`/admin?days=${d}&view=${view}`}
            className={d === days ? SELECTED_LINK : UNSELECTED_LINK}
            aria-current={d === days ? "page" : undefined}
          >
            {d} 日
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="KPI">
        <KpiCard title="總搜尋次數" pct={null} count={data.kpi.totalSearches} />
        <KpiCard
          title="快取命中"
          pct={data.kpi.cacheHitPct}
          count={data.kpi.cacheHitCount}
        />
        <KpiCard
          title="搵唔到"
          pct={data.kpi.noMatchPct}
          count={data.kpi.noMatchCount}
        />
        <KpiCard
          title="撞名多間"
          pct={data.kpi.ambiguousPct}
          count={data.kpi.ambiguousCount}
        />
      </section>

      <p className="text-xs text-muted-foreground">
        按類型：公司名 {data.kpi.byInputType.company_name}・電話{" "}
        {data.kpi.byInputType.phone}・BR {data.kpi.byInputType.br}
        {data.kpi.byInputType.unknown > 0
          ? `・未知 ${data.kpi.byInputType.unknown}`
          : ""}
      </p>

      <nav
        className="flex flex-nowrap gap-2 overflow-x-auto"
        aria-label="視圖"
      >
        {VIEW_TABS.map((tab) => (
          <Link
            key={tab.id}
            prefetch={false}
            href={`/admin?days=${days}&view=${tab.id}`}
            className={`shrink-0 whitespace-nowrap ${
              tab.id === view ? SELECTED_LINK : UNSELECTED_LINK
            }`}
            aria-current={tab.id === view ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {errorMessage ? null : rows.length === 0 ? (
        <EmptyStateCard />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-[36rem] w-full text-left text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">搜尋詞</th>
                <th className="px-3 py-2 font-medium">字數</th>
                <th className="px-3 py-2 font-medium">次數</th>
                <th className="px-3 py-2 font-medium">結果</th>
                <th className="px-3 py-2 font-medium">名冊配對</th>
                <th className="px-3 py-2 font-medium">最後搜尋（香港時間）</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <TermTableRow key={`${i}-${row.lastSeen}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errorMessage ? null : dailyTotal === 0 ? (
        <EmptyStateCard />
      ) : (
        <section aria-label="每日搜尋量">
          <h2 className="mb-3 text-sm font-semibold text-primary">每日搜尋量</h2>
          <DailyBarChart daily={data.daily} max={maxDaily} />
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">每日搜尋量詳情</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-2">日期</th>
                <th className="py-1 pr-2">次數</th>
                <th className="py-1">快取命中 %</th>
              </tr>
            </thead>
            <tbody>
              {data.daily.map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <td className="py-1 pr-2">{d.day}</td>
                  <td className="py-1 pr-2">{d.searches}</td>
                  <td className="py-1">{d.cacheHitPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <aside className="rounded-md border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
        <p>
          每個唔同嘅搜尋詞只會出現一次（大細楷當同一個詞）。搜尋失敗嘅暫時未有紀錄，亦未計到每次有幾多個候選公司。電話同
          BR 只計次數，唔會顯示內容。
        </p>
        {data.kpi.missingCacheRow > 0 ? (
          <p className="mt-2">
            有 {data.kpi.missingCacheRow} 次搜尋搵唔返報告紀錄
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function EmptyStateCard() {
  return (
    <p
      className="flex min-h-44 items-center justify-center rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground"
    >
      呢段時間未有搜尋紀錄
    </p>
  );
}

function KpiCard({
  title,
  pct,
  count,
}: {
  title: string;
  pct: number | null;
  count: number | null;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      {pct != null ? (
        <p className="text-lg font-semibold text-foreground">{pct}%</p>
      ) : (
        <p className="text-lg font-semibold text-foreground">{count}</p>
      )}
      {pct != null && count != null ? (
        <p className="text-xs text-muted-foreground">{count} 次</p>
      ) : null}
    </div>
  );
}

function TermTableRow({ row }: { row: TermRow }) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">{row.term}</td>
      <td className="px-3 py-2">{row.length}</td>
      <td className="px-3 py-2">{row.searches}</td>
      <td className="px-3 py-2">{outcomeLabelZh(row.outcome)}</td>
      <td className="px-3 py-2">{row.matchedName?.trim() ? row.matchedName : "—"}</td>
      <td className="px-3 py-2 whitespace-nowrap">{formatHkDateTime(row.lastSeen)}</td>
    </tr>
  );
}

function DailyBarChart({
  daily,
  max,
}: {
  daily: SearchAnalyticsAggregate["daily"];
  max: number;
}) {
  const height = 120;
  const width = Math.max(280, daily.length * 12);
  return (
    <svg
      role="img"
      aria-label="每日搜尋量柱狀圖"
      viewBox={`0 0 ${width} ${height}`}
      className="w-full max-w-full text-primary"
      preserveAspectRatio="none"
    >
      {daily.map((d, i) => {
        const barW = width / daily.length - 2;
        const h = (d.searches / max) * (height - 16);
        const x = i * (width / daily.length) + 1;
        const y = height - h - 8;
        return (
          <rect
            key={d.day}
            x={x}
            y={y}
            width={barW}
            height={Math.max(0, h)}
            fill="currentColor"
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}
