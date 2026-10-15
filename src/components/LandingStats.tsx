import { CalendarDays, Database } from "lucide-react";
import {
  formatMwcRegistryUpdatedAt,
  type LandingPublicStats,
} from "@/lib/landing-public-stats";

type LandingStatsProps = {
  stats: LandingPublicStats;
};

const statIconClass =
  "mt-0.5 size-3.5 shrink-0 justify-self-center text-primary/70 sm:size-4";

export function LandingStats({ stats }: LandingStatsProps) {
  if (stats.mwcContractorCount <= 0) return null;

  const countLabel = stats.mwcContractorCount.toLocaleString("zh-HK");
  const updatedLabel = stats.mwcSourceUpdatedAt
    ? formatMwcRegistryUpdatedAt(stats.mwcSourceUpdatedAt)
    : null;

  return (
    <aside
      className="grid w-full grid-cols-[1rem_1fr] items-start gap-x-2 gap-y-1 self-start text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-[1.125rem_1fr] sm:text-xs"
      aria-label="公開資料規模"
    >
      <Database className={statIconClass} aria-hidden />
      <p className="min-w-0">
        <span className="font-medium tabular-nums text-foreground/80">
          {countLabel}
        </span>{" "}
        條屋宇署 MWC 小型工程承辦商公開登記
      </p>
      {updatedLabel ? (
        <>
          <CalendarDays
            className={`${statIconClass} text-primary/60`}
            aria-hidden
          />
          <p className="min-w-0 text-muted-foreground/90">
            名冊資料截至 {updatedLabel}
          </p>
        </>
      ) : null}
    </aside>
  );
}
