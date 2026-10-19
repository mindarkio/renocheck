import { ExternalLink, FileText } from "lucide-react";
import type { ReactNode } from "react";
import {
  judgmentCategoryLabelZh,
  outcomeHintLabelZh,
  LEGAL_EVENTS_AI_VERIFIED_ZH,
  LEGAL_EVENTS_AUTO_SUMMARY_ZH,
  LEGAL_EVENTS_FACTS_ONLY_ZH,
  LEGAL_EVENTS_SCOPE_ZH,
  partyRoleLabelZh,
} from "@/lib/legal-event-display";
import { formatReportGeneratedAtHkt } from "@/lib/format-report-generated-at";
import { hearingSummaryPendingForEvent } from "@/lib/judgment-hearing-summary";
import type { OfficialLegalEvent } from "@/lib/legal-event-schema";
import { judgmentDedupeKey } from "@/lib/lookup-legal-judgments";
import { LEGAL_EVENT_SOURCE_LINK_LABEL_ZH } from "@/lib/report-trust-copy-zh";
import { brandReportSectionTitleClass } from "@/lib/ui-surfaces";

const reportBlockClass = "px-5 py-5 sm:px-6 sm:py-6";
const reportMetaClass =
  "text-xs leading-[1.65] text-muted-foreground sm:text-[13px]";

const tableHeadClass =
  "whitespace-nowrap px-2 py-2 text-left text-[13px] font-semibold text-muted-foreground first:pl-0 last:pr-0";
const tableCellClass =
  "px-2 py-3 text-[13px] leading-snug first:pl-0 last:pr-0 xl:text-sm";
const tableNowrapCellClass = `whitespace-nowrap ${tableCellClass}`;

/** Break long CJK labels only at ／ or before （, never character-by-character. */
function withCjkSoftBreaks(text: string): ReactNode {
  const parts = text
    .split(/(?<=／)|(?=（)/u)
    .filter((part) => part.length > 0);
  return parts.map((part, index) => (
    <span key={`${index}-${part}`} className="whitespace-nowrap">
      {index > 0 ? <wbr /> : null}
      {part}
    </span>
  ));
}

function courtHasCjk(court: string): boolean {
  return /[\u3400-\u9fff]/u.test(court);
}

function ReportExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
      <ExternalLink className="ms-1 inline size-3.5 opacity-80" aria-hidden />
      <span className="sr-only">（新分頁開啟）</span>
    </a>
  );
}

function LegalEventDetails({
  ev,
  factsOnly,
}: {
  ev: OfficialLegalEvent;
  factsOnly: boolean;
}) {
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
      {!factsOnly ? (
        <>
          {ev.hearingPointsSource === "ai_verified" ? (
            <p>{LEGAL_EVENTS_AI_VERIFIED_ZH}</p>
          ) : ev.hearingPointsSource === "llm_draft" ? (
            <p>{LEGAL_EVENTS_AUTO_SUMMARY_ZH}</p>
          ) : null}
          <ul className="list-disc space-y-2 pl-5 marker:text-primary/40 text-foreground/90">
            {ev.hearingKeyPointsZh.map((point, pointIndex) => {
              const quote =
                ev.hearingKeyPointQuotesZh?.[pointIndex]?.trim();
              return (
                <li key={`${pointIndex}-${point}`}>
                  <span>{point}</span>
                  {quote ? (
                    <details className="mt-1.5 group">
                      <summary
                        className="cursor-pointer list-none text-xs font-medium text-primary underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden"
                      >
                        <span className="inline-flex items-center gap-1">
                          判詞引文
                          <span
                            className="text-xs font-normal text-muted-foreground group-open:hidden"
                            aria-hidden
                          >
                            （展開）
                          </span>
                        </span>
                      </summary>
                      <p
                        className="mt-1.5 whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs leading-relaxed"
                      >
                        {quote}
                      </p>
                      <a
                        href={ev.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                      >
                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                        判詞原文（Legal Ref）
                      </a>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      <p>{ev.matchReasonZh}</p>
    </div>
  );
}

function CaseRefCell({ ev }: { ev: OfficialLegalEvent }) {
  const refs = [ev.caseRef, ...(ev.relatedCaseRefs ?? [])];
  return (
    <div>
      {refs.map((ref) => (
        <span key={ref} className="block whitespace-nowrap font-medium">
          {ref}
        </span>
      ))}
      {ev.businessForm === "sole_proprietorship" && ev.defendantDisplayNameZh ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 font-normal">
          <span className="text-foreground">{ev.defendantDisplayNameZh}</span>
          <span
            className="inline-flex rounded-full border border-muted-foreground/25 bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground"
          >
            獨資經營
          </span>
        </p>
      ) : null}
    </div>
  );
}

export function LegalEventsTable({
  events,
  registryAsOf,
}: {
  events: OfficialLegalEvent[];
  registryAsOf?: string;
}) {
  const factsOnlyBanner = events.some((ev) =>
    hearingSummaryPendingForEvent(
      ev.hearingKeyPointsZh,
      ev.hearingPointsSource,
    ),
  );

  return (
    <section
      className={reportBlockClass}
      aria-labelledby="legal-events-heading"
    >
      <h3
        id="legal-events-heading"
        className={`flex items-center gap-2 ${brandReportSectionTitleClass}`}
      >
        <FileText className="size-5 shrink-0 text-primary" aria-hidden />
        {`公開判詞紀錄（${events.length} 宗）`}
      </h3>

      {factsOnlyBanner ? (
        <p className={`${reportMetaClass} -mt-1 mb-3`}>
          {LEGAL_EVENTS_FACTS_ONLY_ZH}
        </p>
      ) : (
        <p className={`${reportMetaClass} -mt-1 mb-3`}>
          {LEGAL_EVENTS_SCOPE_ZH}
        </p>
      )}

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse">
          <caption className="sr-only">公開判詞紀錄</caption>
          <thead>
            <tr className="border-b border-border/60 text-left">
              {[
                "案件編號",
                "中立引用",
                "法院",
                "判決日期",
                "公司角色",
                "類別",
                "結果",
                "判詞",
              ].map((label) => (
                <th key={label} scope="col" className={tableHeadClass}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          {events.map((ev) => {
            const factsOnly = hearingSummaryPendingForEvent(
              ev.hearingKeyPointsZh,
              ev.hearingPointsSource,
            );
            return (
              <tbody
                key={judgmentDedupeKey(ev)}
                data-testid="legal-event-row"
                className="border-b border-border/50"
              >
                <tr className="align-top">
                  <td className={tableCellClass}>
                    <CaseRefCell ev={ev} />
                  </td>
                  <td className={tableNowrapCellClass}>
                    {ev.neutralCitation ?? "—"}
                  </td>
                  <td
                    className={
                      courtHasCjk(ev.court)
                        ? tableNowrapCellClass
                        : `${tableCellClass} min-w-[8.5rem]`
                    }
                  >
                    {courtHasCjk(ev.court)
                      ? withCjkSoftBreaks(ev.court)
                      : ev.court}
                  </td>
                  <td className={tableNowrapCellClass}>
                    <time dateTime={ev.eventDate}>{ev.eventDate}</time>
                  </td>
                  <td className={tableNowrapCellClass}>
                    {partyRoleLabelZh(ev.partyRole)}
                  </td>
                  <td className={tableCellClass}>
                    {withCjkSoftBreaks(
                      judgmentCategoryLabelZh(ev.judgmentCategory),
                    )}
                  </td>
                  <td className={tableNowrapCellClass}>
                    {ev.outcomeHint
                      ? outcomeHintLabelZh(ev.outcomeHint)
                      : "—"}
                  </td>
                  <td className={tableNowrapCellClass}>
                    <ReportExternalLink
                      href={ev.sourceUrl}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {LEGAL_EVENT_SOURCE_LINK_LABEL_ZH}
                    </ReportExternalLink>
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={8}
                    className="bg-muted/20 px-2 py-3 text-[13px] first:pl-0 last:pr-0"
                  >
                    <LegalEventDetails ev={ev} factsOnly={factsOnly} />
                  </td>
                </tr>
              </tbody>
            );
          })}
        </table>
      </div>

      <ul className="list-none space-y-4 p-0 lg:hidden">
        {events.map((ev) => {
          const factsOnly = hearingSummaryPendingForEvent(
            ev.hearingKeyPointsZh,
            ev.hearingPointsSource,
          );
          return (
            <li
              key={judgmentDedupeKey(ev)}
              data-testid="legal-event-card"
              className="rounded-lg border border-border/60 bg-card px-3 py-3"
            >
              <CaseRefCell ev={ev} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className={reportMetaClass}>中立引用</dt>
                <dd>{ev.neutralCitation ?? "—"}</dd>
                <dt className={reportMetaClass}>法院</dt>
                <dd>{ev.court}</dd>
                <dt className={reportMetaClass}>判決日期</dt>
                <dd>
                  <time dateTime={ev.eventDate}>{ev.eventDate}</time>
                </dd>
                <dt className={reportMetaClass}>公司角色</dt>
                <dd>{partyRoleLabelZh(ev.partyRole)}</dd>
                <dt className={reportMetaClass}>類別</dt>
                <dd>{judgmentCategoryLabelZh(ev.judgmentCategory)}</dd>
                <dt className={reportMetaClass}>結果</dt>
                <dd>
                  {ev.outcomeHint
                    ? outcomeHintLabelZh(ev.outcomeHint)
                    : "—"}
                </dd>
              </dl>
              <ReportExternalLink
                href={ev.sourceUrl}
                className="mt-3 inline-flex items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                {LEGAL_EVENT_SOURCE_LINK_LABEL_ZH}
              </ReportExternalLink>
              <div className="mt-2">
                <LegalEventDetails ev={ev} factsOnly={factsOnly} />
              </div>
            </li>
          );
        })}
      </ul>

      {registryAsOf ? (
        <p className={`mt-3 ${reportMetaClass}`}>
          判詞庫摘錄截至{" "}
          <time dateTime={registryAsOf}>
            {formatReportGeneratedAtHkt(registryAsOf)}
          </time>
        </p>
      ) : null}
    </section>
  );
}
