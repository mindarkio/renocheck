import type { ReactNode } from "react";
import Link from "next/link";
import { submitAdminLogout } from "@/app/admin/logout/actions";
import { outcomeLabelZh } from "@/lib/admin/outcome-labels";
import type { GeminiUsageCardResult } from "@/lib/admin/gemini-usage-view";
import {
  formatHkDateTime,
  type AnalyticsDays,
  type SearchAnalyticsAggregate,
  type SearchAnalyticsView,
  type TermRow,
} from "@/lib/admin/search-analytics";
import {
  emptyReturnAnalytics,
  type ReturnAnalytics,
} from "@/lib/admin/return-analytics";

const VIEW_TABS: { id: SearchAnalyticsView; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "none", label: "搵唔到" },
  { id: "cr_matched", label: "公司註冊處搵到" },
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
  gemini?: GeminiUsageCardResult;
  returns?: ReturnAnalytics;
};

export function AdminDashboardView({
  data,
  days,
  view,
  errorMessage,
  gemini,
  returns = emptyReturnAnalytics(),
}: Props) {
  const errored = Boolean(errorMessage);
  const rows = data.views[view] ?? data.terms;
  const dailyTotal = data.daily.reduce((sum, d) => sum + d.searches, 0);
  const maxDaily = Math.max(1, ...data.daily.map((d) => d.searches));

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col space-y-8 px-4 py-6 text-foreground">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 shrink text-xl font-semibold text-primary">搜尋數據</h1>
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

      <nav className="flex min-w-0 flex-wrap gap-2" aria-label="日期範圍">
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

      <section
        className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4"
        aria-label="KPI"
      >
        <KpiCard
          title="總搜尋次數"
          pct={null}
          count={data.kpi.totalSearches}
          unavailable={errored}
        />
        <KpiCard
          title="快取命中"
          pct={data.kpi.cacheHitPct}
          count={data.kpi.cacheHitCount}
          unavailable={errored}
        />
        <KpiCard
          title="搵唔到"
          pct={data.kpi.noMatchPct}
          count={data.kpi.noMatchCount}
          unavailable={errored}
        />
        <KpiCard
          title="撞名多間"
          pct={data.kpi.ambiguousPct}
          count={data.kpi.ambiguousCount}
          unavailable={errored}
        />
        <KpiCard
          title="公司註冊處搵到"
          pct={data.kpi.crMatchedPct}
          count={data.kpi.crMatchedCount}
          unavailable={errored}
        />
      </section>

      <p className="min-w-0 break-words text-xs text-muted-foreground">
        按類型：公司名 {errored ? <Unavailable /> : data.kpi.byInputType.company_name}・電話{" "}
        {errored ? <Unavailable /> : data.kpi.byInputType.phone}・BR{" "}
        {errored ? <Unavailable /> : data.kpi.byInputType.br}
        {!errored && data.kpi.byInputType.unknown > 0
          ? `・未知 ${data.kpi.byInputType.unknown}`
          : ""}
      </p>

      <div className="relative min-w-0 w-full max-w-full">
        <nav
          className="flex w-full min-w-0 max-w-full flex-nowrap gap-2 overflow-x-auto pr-6 scroll-pe-6"
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
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent"
          aria-hidden
        />
      </div>

      {errorMessage ? null : rows.length === 0 ? (
        <EmptyStateCard />
      ) : (
        <div className="min-w-0 w-full max-w-full overflow-x-auto rounded-md border border-border">
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
        <section className="min-w-0" aria-label="每日搜尋量">
          <h2 className="mb-3 text-sm font-semibold text-primary">每日搜尋量</h2>
          <EmptyStateCard />
        </section>
      ) : (
        <section className="min-w-0" aria-label="每日搜尋量">
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

      <div className="min-w-0 space-y-2 text-[13px] text-muted-foreground">
        <p className="break-words">
          每個唔同嘅搜尋詞只會出現一次（大細楷當同一個詞）。搜尋失敗嘅暫時未有紀錄，亦未計到每次有幾多個候選公司。電話同
          BR 只計次數，唔會顯示內容。
        </p>
        {!errored && data.kpi.missingCacheRow > 0 ? (
          <p className="break-words">
            有 {data.kpi.missingCacheRow} 次搜尋搵唔返報告紀錄
          </p>
        ) : null}
      </div>

      {gemini ? <GeminiUsageSection gemini={gemini} /> : null}

      {errored ? null : <ReturnAnalyticsSection data={returns} />}
    </div>
  );
}

function limitLabel(limit: number | null): string {
  return limit == null ? "未設定" : String(limit);
}

function GeminiUsageSection({ gemini }: { gemini: GeminiUsageCardResult }) {
  if (!gemini.ok) {
    return (
      <section className="min-w-0 border-t border-border pt-6" aria-label="AI 用量（Gemini）">
        <h2 className="mb-3 text-sm font-semibold text-primary">AI 用量（Gemini）</h2>
        <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <GeminiRow label="今日已用" value={<Unavailable />} />
          <GeminiRow label="每日上限" value={<Unavailable />} />
          <GeminiRow label="每分鐘上限" value={<Unavailable />} />
          <GeminiRow label="429（24 小時）" value={<Unavailable />} />
          <GeminiRow label="爆每日上限" value={<Unavailable />} />
          <GeminiRow label="爆每分鐘上限" value={<Unavailable />} />
          <GeminiRow label="伺服器錯誤（24 小時）" value={<Unavailable />} />
          <GeminiRow label="最後一次 429" value={<Unavailable />} />
          <GeminiRow label="下次重置（香港時間）" value={<Unavailable />} />
        </dl>
      </section>
    );
  }

  const card = gemini.data;
  return (
    <section className="min-w-0 border-t border-border pt-6" aria-label="AI 用量（Gemini）">
      <h2 className="mb-3 text-sm font-semibold text-primary">AI 用量（Gemini）</h2>
      {card.providerLabel ? (
        <p className="mb-3 min-w-0 break-all text-xs text-muted-foreground">
          {card.providerLabel}
        </p>
      ) : null}
      {card.warning ? (
        <div
          className="mb-3 rounded-md border border-warning bg-warning-foreground px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          過去 24 小時撞過 Gemini 上限，用戶可能搜唔到
        </div>
      ) : null}
      <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <GeminiRow
          label="今日已用"
          value={`${card.usedToday} / ${limitLabel(card.rpdLimit)}`}
        />
        <GeminiRow label="每日上限" value={limitLabel(card.rpdLimit)} />
        <GeminiRow label="每分鐘上限" value={limitLabel(card.rpmLimit)} />
        <GeminiRow label="429（24 小時）" value={String(card.http429)} />
        <GeminiRow label="爆每日上限" value={String(card.quotaDay)} />
        <GeminiRow label="爆每分鐘上限" value={String(card.rateMinute)} />
        <GeminiRow label="伺服器錯誤（24 小時）" value={String(card.server5xx)} />
        <GeminiRow
          label="最後一次 429"
          value={card.last429At ? formatHkDateTime(card.last429At) : "—"}
        />
        <GeminiRow
          label="下次重置（香港時間）"
          value={formatHkDateTime(card.nextReset)}
        />
      </dl>
      <div className="mt-3 min-w-0 space-y-2 text-[13px] text-muted-foreground">
        <p className="break-words">
          Google 每日上限喺美國太平洋時間半夜 12 點重置，實際時間睇上面『下次重置』。
        </p>
        <p className="break-words">
          次數只計到呢部伺服器，重新部署會清零；『今日已用』最少有呢個數。
        </p>
        {card.providerKind === "gateway" ? (
          <p className="break-words">而家用緊 AI Gateway，唔係 Gemini。</p>
        ) : null}
      </div>
    </section>
  );
}

function ReturnAnalyticsSection({ data }: { data: ReturnAnalytics }) {
  return (
    <section className="min-w-0 border-t border-border pt-6" aria-label="重複使用">
      <h2 className="mb-3 text-sm font-semibold text-primary">重複使用</h2>
      <p className="mb-3 break-words text-[13px] text-muted-foreground">
        呢啲數字會少計：換裝置或瀏覽器、清除瀏覽器儲存、或者用 WhatsApp／IG 內置瀏覽器，都會當成另一部裝置。
      </p>
      {data.searchAnon === "pending" || data.usageEvents === "pending" ? (
        <p className="mb-3 break-words text-sm text-muted-foreground">
          資料庫變更尚未套用，未有欄位或資料表嘅數字暫時係 0。
        </p>
      ) : null}
      {data.truncated ? (
        <p className="mb-3 text-sm text-muted-foreground">數據太多，只計咗最近 50,000 筆</p>
      ) : null}
      {data.readError ? (
        <p className="text-sm text-muted-foreground">讀取重複使用數據出錯，請遲啲再試</p>
      ) : (
        <div className="min-w-0 space-y-6">
          <div className="min-w-0 overflow-x-auto">
            <h3 className="mb-2 text-sm font-medium text-foreground">每週新裝置同再來裝置</h3>
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">週開始（香港時間）</th>
                  <th className="py-1 pr-2 font-medium">新裝置</th>
                  <th className="py-1 font-medium">再來裝置</th>
                </tr>
              </thead>
              <tbody>
                {data.weeks.map((week) => (
                  <tr key={week.weekStart} className="border-t border-border">
                    <td className="py-1 pr-2">{week.weekStart}</td>
                    <td className="py-1 pr-2">{week.newDevices}</td>
                    <td className="py-1">{week.returningDevices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">隔幾耐再來</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CountItem label="1 日內（相隔 30 分鐘以上）" value={data.intervals.within1Day} />
              <CountItem label="7 日內（超過 1 日）" value={data.intervals.within7Days} />
              <CountItem label="30 日內（超過 7 日）" value={data.intervals.within30Days} />
              <CountItem label="超過 30 日" value={data.intervals.over30Days} />
            </dl>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">再來嘅人做過咩</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CountItem label="再搜同一間公司" value={data.returnerActions.sameCompany} />
              <CountItem label="再搜另一間公司" value={data.returnerActions.differentCompany} />
              <CountItem label="用過報價自查" value={data.returnerActions.usedQuote} />
            </dl>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-foreground">使用次數</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <CountItem label="報價自查頁" value={data.funnel.quotePage} />
              <CountItem label="20 項都揀咗" value={data.funnel.quoteAllTicked} />
              <CountItem label="複製回覆訊息" value={data.funnel.quoteCopyReply} />
              <CountItem label="官方連結" value={data.funnel.reportOfficialLink} />
              <CountItem label="分享報告" value={data.funnel.reportShare} />
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}

function CountItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function GeminiRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{value}</dd>
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

/** Visible em dash; screen readers hear 「未能讀取」 instead of "dash". Never a 0. */
function Unavailable() {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">未能讀取</span>
    </>
  );
}

function KpiCard({
  title,
  pct,
  count,
  unavailable = false,
}: {
  title: string;
  pct: number | null;
  count: number | null;
  unavailable?: boolean;
}) {
  const main = unavailable ? <Unavailable /> : pct != null ? `${pct}%` : count;
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-lg font-semibold text-foreground">{main}</p>
      {!unavailable && pct != null && count != null ? (
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
