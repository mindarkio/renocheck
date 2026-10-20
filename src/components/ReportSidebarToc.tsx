import { buildReportTocEntries } from "@/lib/report-section-toc";
import type { RiskReport } from "@/lib/report-schema";
import { reportSidebarStickyClass } from "./report-column";

export function ReportSidebarToc({ report }: { report: RiskReport }) {
  const entries = buildReportTocEntries(report);

  return (
    <nav
      className={reportSidebarStickyClass}
      aria-label="報告章節"
      data-testid="report-sidebar-toc"
    >
      <ul className="list-none space-y-2 p-0 text-sm leading-[22px]">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className="block rounded-md py-1 text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-6 min-h-[4rem]" aria-hidden data-testid="report-sidebar-reserved" />
    </nav>
  );
}
