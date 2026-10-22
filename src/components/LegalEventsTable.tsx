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
import {
  reportBlockPaddingClass,
  reportExternalLinkTouchClass,
  reportH2SectionClass,
  reportMetaTextClass,
} from "@/lib/report-tokens";

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
      className={`${reportExternalLinkTouchClass} ${className ?? ""}`}
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
    <div className={`space-y-2 ${reportMetaTextClass}`}>
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
                        className="cursor-pointer list-none text-sm font-medium text-primary underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden"
                      >
                        <span className="inline-flex items-center gap-1">
                          判詞引文
                          <span
                            className="text-sm font-normal text-muted-foreground group-open:hidden"
                            aria-hidden
                          >
                            （展開）
                          </span>
                        </span>
                      </summary>
                      <p
                        className="mt-1.5 whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-sm leading-relaxed"
                      >
                        {quote}
                      </p>
                      <a
                        href={ev.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline ${reportExternalLinkTouchClass}`}
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

function CaseRefBlock({ ev }: { ev: OfficialLegalEvent }) {
  const refs = [ev.caseRef, ...(ev.relatedCaseRefs ?? [])];
  return (
    <div>
      {refs.map((ref) => (
        <span
          key={ref}
          className="block whitespace-nowrap font-medium tabular-nums lg:inline lg:me-2"
        >
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

const FIELD_LABELS = [
  "案件編號",
  "中立引用",
  "法院",
  "判決日期",
  "公司角色",
  "類別",
  "結果",
  "判詞",
] as const;

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
      className={reportBlockPaddingClass}
      aria-labelledby="legal-events-heading"
    >
      <h2
        id="legal-events-heading"
        className={`flex items-center gap-2 ${reportH2SectionClass}`}
      >
        <FileText className="size-5 shrink-0 text-primary" aria-hidden />
        {`公開判詞紀錄（${events.length} 宗）`}
      </h2>

      {factsOnlyBanner ? (
        <p className={`${reportMetaTextClass} -mt-1 mb-3`}>
          {LEGAL_EVENTS_FACTS_ONLY_ZH}
        </p>
      ) : (
        <p className={`${reportMetaTextClass} -mt-1 mb-3`}>
          {LEGAL_EVENTS_SCOPE_ZH}
        </p>
      )}

      <ul className="list-none space-y-4 p-0">
        {events.map((ev) => {
          const factsOnly = hearingSummaryPendingForEvent(
            ev.hearingKeyPointsZh,
            ev.hearingPointsSource,
          );
          return (
            <li
              key={judgmentDedupeKey(ev)}
              data-testid="legal-event-card"
              className="rounded-lg border border-border/60 bg-card px-4 py-4 lg:px-4 lg:py-2"
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm leading-snug lg:grid-cols-[minmax(0,1fr)_auto] lg:items-baseline lg:gap-x-4 lg:gap-y-1">
                <div className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:min-w-0 lg:flex-wrap lg:items-baseline lg:gap-x-3">
                  <dt className={`${reportMetaTextClass} lg:sr-only`}>
                    {FIELD_LABELS[0]}
                  </dt>
                  <dd>
                    <CaseRefBlock ev={ev} />
                  </dd>
                  <dt className={`${reportMetaTextClass} lg:sr-only`}>
                    {FIELD_LABELS[1]}
                  </dt>
                  <dd className="tabular-nums">{ev.neutralCitation ?? "—"}</dd>
                </div>
                <div className="contents lg:col-span-2 lg:row-start-2 lg:flex lg:flex-wrap lg:items-baseline">
                  <dt className={`${reportMetaTextClass} lg:sr-only`}>
                    {FIELD_LABELS[2]}
                  </dt>
                  <dd>
                    {/[\u3400-\u9fff]/u.test(ev.court)
                      ? withCjkSoftBreaks(ev.court)
                      : ev.court}
                  </dd>
                  <span className="hidden lg:inline" aria-hidden>
                    {" · "}
                  </span>
                  <dt className={`${reportMetaTextClass} lg:sr-only`}>
                    {FIELD_LABELS[3]}
                  </dt>
                  <dd>
                    <time className="tabular-nums" dateTime={ev.eventDate}>
                      {ev.eventDate}
                    </time>
                  </dd>
                  <span className="hidden lg:inline" aria-hidden>
                    {" · "}
                  </span>
                  <dt className={`${reportMetaTextClass} lg:sr-only`}>
                    {FIELD_LABELS[4]}
                  </dt>
                  <dd>{partyRoleLabelZh(ev.partyRole)}</dd>
                  <span className="hidden lg:inline" aria-hidden>
                    {" · "}
                  </span>
                  <dt className={`${reportMetaTextClass} lg:sr-only`}>
                    {FIELD_LABELS[5]}
                  </dt>
                  <dd>
                    {withCjkSoftBreaks(
                      judgmentCategoryLabelZh(ev.judgmentCategory),
                    )}
                  </dd>
                  <span className="hidden lg:inline" aria-hidden>
                    {" · "}
                  </span>
                  <dt className={`${reportMetaTextClass} lg:sr-only`}>
                    {FIELD_LABELS[6]}
                  </dt>
                  <dd>
                    {ev.outcomeHint
                      ? outcomeHintLabelZh(ev.outcomeHint)
                      : "—"}
                  </dd>
                </div>
                <div className="contents lg:col-start-2 lg:row-start-1 lg:shrink-0">
                  <dt className={`${reportMetaTextClass} lg:sr-only`}>
                    {FIELD_LABELS[7]}
                  </dt>
                  <dd>
                    <ReportExternalLink
                      href={ev.sourceUrl}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {LEGAL_EVENT_SOURCE_LINK_LABEL_ZH}
                    </ReportExternalLink>
                  </dd>
                </div>
              </dl>
              <div className="mt-3 border-t border-border/50 pt-3 lg:mt-1 lg:border-t-0 lg:pt-0">
                <LegalEventDetails ev={ev} factsOnly={factsOnly} />
              </div>
            </li>
          );
        })}
      </ul>

      {registryAsOf ? (
        <p className={`mt-3 ${reportMetaTextClass}`}>
          判詞庫摘錄截至{" "}
          <time className="tabular-nums" dateTime={registryAsOf}>
            {formatReportGeneratedAtHkt(registryAsOf)}
          </time>
        </p>
      ) : null}
    </section>
  );
}
