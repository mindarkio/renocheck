import {
  BadgeCheck,
  CircleHelp,
  ExternalLink,
  FileText,
  Gauge,
  Info,
  Link2,
  ListChecks,
  MessageSquare,
  ScanSearch,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { buildBdMwcRegistrySearchUrl } from "@/lib/bd-mwc-registry-url";
import { buildJudiciaryDeepLinks } from "@/lib/judiciary-search-deep-links";
import {
  judgmentCategoryLabelZh,
  LEGAL_EVENTS_AUTO_SUMMARY_ZH,
  LEGAL_EVENTS_FACTS_ONLY_ZH,
  LEGAL_EVENTS_SCOPE_ZH,
  partyRoleLabelZh,
} from "@/lib/legal-event-display";
import { hearingSummaryPendingForEvent } from "@/lib/judgment-hearing-summary";
import { formatReportGeneratedAtHkt } from "@/lib/format-report-generated-at";
import {
  formatMwcExpiryDateZh,
  isMwcExpiryBeforeReport,
} from "@/lib/mwc-registry-display";
import type { RiskReport } from "@/lib/report-schema";
import {
  riskBandMeterActiveLabelClass,
  riskBandSurfaceClass,
} from "@/lib/risk-band-display";
import {
  brandReportSectionTitleClass,
  surfaceCardClass as reportShellClass,
} from "@/lib/ui-surfaces";
import { RiskBandMeter } from "./RiskBandMeter";

function confidenceLabelZh(confidence: RiskReport["confidence"]): string {
  if (confidence === "high") return "較高";
  if (confidence === "medium") return "中等";
  return "較低";
}

function dataSaturationCaution(
  saturation: RiskReport["evaluation"]["dataSaturation"],
): string | null {
  if (saturation === "sparse") {
    return "官方名冊有登記；本次未檢出公開糾紛討論。風險參考為中性，並不表示工程無風險。";
  }
  if (saturation === "unindexed") {
    return "名冊未匹配或公開資料不足以評估口碑，請自行核實牌照與合約。";
  }
  if (saturation === "moderate") {
    return "已檢出與查詢相關的公開來源；若未列出討論摘要，請以下方連結自行核實。";
  }
  return null;
}

function mwcRegistrySearchHref(report: RiskReport): string | null {
  if (report.evaluation.complianceTrack.licenseStatus !== "active") {
    return null;
  }
  const details = report.official.details;
  return buildBdMwcRegistrySearchUrl({
    companyName: details?.companyName ?? report.entity.searchLabelUsed,
    registrationNo: details?.registrationNo,
  });
}

function licenseStatusChip(report: RiskReport): {
  label: string;
  tone: "primary" | "warning" | "muted";
} {
  const status = report.evaluation.complianceTrack.licenseStatus;
  if (status === "active") {
    return { label: "政府名冊有登記", tone: "primary" };
  }
  if (status === "ambiguous") {
    return { label: "政府名冊需再核實", tone: "warning" };
  }
  return { label: "政府名冊未匹配", tone: "muted" };
}

function disputeChip(report: RiskReport): string {
  const { disputeLevel, recentDisputeCount } = report.evaluation.reputationTrack;
  switch (disputeLevel) {
    case "none_detected":
      return "未檢出活躍投訴";
    case "historical_isolated":
      return recentDisputeCount > 0
        ? `較早提及 · ${recentDisputeCount} 則`
        : "較早公開提及";
    case "active_concerning":
      return recentDisputeCount > 0
        ? `近期糾紛提及 · ${recentDisputeCount} 則`
        : "近期糾紛提及";
    case "severe":
      return "多宗可引用討論";
    default:
      return "請核實來源";
  }
}

function heroChipToneClass(tone: "primary" | "warning" | "muted"): string {
  if (tone === "warning") {
    return "border-amber-200/60 bg-amber-50/95 text-amber-950";
  }
  if (tone === "primary") {
    return "border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground";
  }
  return "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground/85";
}

type IncidentType = NonNullable<
  NonNullable<RiskReport["signals"]["highlights"]>[number]["incidentType"]
>;

type DiscussionHighlight = NonNullable<
  RiskReport["signals"]["highlights"]
>[number];

function highlightCardTitle(h: DiscussionHighlight): string {
  return (h.factSummary?.trim() || h.summaryZh).trim();
}

function highlightCardBody(h: DiscussionHighlight): string | null {
  const title = highlightCardTitle(h);
  const detail = h.summaryZh.trim();
  if (h.factSummary?.trim() && detail && detail !== title) {
    return detail;
  }
  return null;
}

/** e.g. 2025-12 → 2025年12月；僅年份 → 2025年 */
function simplifyHighlightWhen(h: DiscussionHighlight): string | null {
  const hint = h.dateHint?.trim();
  if (hint) {
    const ym = hint.match(/^(\d{4})-(\d{1,2})/);
    if (ym) {
      const month = Number.parseInt(ym[2], 10);
      if (month >= 1 && month <= 12) {
        return `${ym[1]}年${month}月`;
      }
      return `${ym[1]}年`;
    }
    if (/^\d{4}$/u.test(hint)) return `${hint}年`;
    const yearInHint = hint.match(/\d{4}/u);
    if (yearInHint) return `${yearInHint[0]}年`;
    return hint.length > 12 ? `${hint.slice(0, 12)}…` : hint;
  }
  const year = h.approxYear?.trim();
  return year ? `${year}年` : null;
}

function incidentHashtag(type: IncidentType): string {
  const tag: Record<IncidentType, string> = {
    payment_dispute: "付款超支",
    quality_defect: "工程質素",
    delay_abandonment: "延誤爛尾",
    communication: "溝通",
    other: "其他",
  };
  return `#${tag[type]}`;
}

function sourceBadgeLabel(sourceName: string, url: string): string {
  const blob = `${sourceName} ${url}`.toLowerCase();
  if (blob.includes("facebook") || blob.includes("fb.com")) return "Facebook";
  if (blob.includes("discuss.com.hk")) return "Discuss";
  if (blob.includes("youtube") || blob.includes("youtu.be")) return "YouTube";
  if (blob.includes("threads")) return "Threads";
  return sourceName;
}

/** Corner ribbon — saturated platform fills, readable on small cards. */
function sourceBadgeAppearance(sourceName: string, url: string): string {
  const blob = `${sourceName} ${url}`.toLowerCase();
  if (blob.includes("lihkg")) {
    return "bg-gradient-to-b from-[#ffe875] to-[#ffcc00] text-[#3a3200] shadow-[0_1px_2px_rgba(80,64,0,0.18)] ring-1 ring-inset ring-[#e6b800]/55";
  }
  if (blob.includes("facebook") || blob.includes("fb.com")) {
    return "bg-[#1877F2] text-white shadow-[0_1px_2px_rgba(13,71,161,0.35)] ring-1 ring-inset ring-white/20";
  }
  if (blob.includes("discuss.com.hk")) {
    return "bg-[#ea580c] text-white shadow-[0_1px_2px_rgba(154,52,18,0.3)] ring-1 ring-inset ring-white/15";
  }
  if (blob.includes("threads")) {
    return "bg-[#1c1c1c] text-white shadow-sm ring-1 ring-inset ring-white/10";
  }
  if (blob.includes("youtube") || blob.includes("youtu.be")) {
    return "bg-[#ff0000] text-white shadow-[0_1px_2px_rgba(153,27,27,0.35)] ring-1 ring-inset ring-white/15";
  }
  if (blob.includes("tkww")) {
    return "bg-primary text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15";
  }
  return "bg-muted text-foreground/85 shadow-sm ring-1 ring-inset ring-border/60";
}

const reportBlockClass = "px-5 py-5 sm:px-6 sm:py-6";

const reportBlockDividerClass = "border-t border-border/60";

const reportSectionTitleClass = brandReportSectionTitleClass;

const reportBodyClass = "text-sm leading-[1.7] text-foreground/90 sm:text-[15px]";

const reportMetaClass =
  "text-xs leading-[1.65] text-muted-foreground sm:text-[13px]";

const reportListRowClass =
  "border-b border-border/50 py-4 last:border-b-0 last:pb-0 first:pt-0";

function SectionHeading({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <h3
      id={id}
      className={`${reportSectionTitleClass} flex items-center gap-2.5`}
    >
      <Icon className="size-[1.125rem] shrink-0 text-primary/75" aria-hidden />
      {children}
    </h3>
  );
}

function ReportBlock({
  id,
  icon,
  title,
  children,
  className = "",
}: {
  id: string;
  icon: LucideIcon;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`${reportBlockClass} ${reportBlockDividerClass} ${className}`}
      aria-labelledby={id}
    >
      <SectionHeading id={id} icon={icon}>{title}</SectionHeading>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ReportCard({ report }: { report: RiskReport }) {
  const highlights = report.signals.highlights ?? [];
  const checklist = report.signals.contractChecklist ?? [];
  const actionable = report.signals.actionableClauses ?? [];
  const saturation = report.evaluation.dataSaturation;
  const saturationNote = dataSaturationCaution(saturation);
  const showSaturationBanner =
    saturation === "unindexed" ||
    (saturation === "moderate" && highlights.length === 0);
  const bandDetail = report.evaluation.riskBandDetailZh;
  const evidenceCount = report.signals.retrievalEvidence?.length ?? 0;
  const officialRegister = report.official.details;
  const license = licenseStatusChip(report);
  const mwcRegistryHref = mwcRegistrySearchHref(report);
  const licenseChipClass = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${heroChipToneClass(license.tone)}`;
  const disputeTone =
    report.evaluation.reputationTrack.disputeLevel === "severe" ||
    report.evaluation.reputationTrack.disputeLevel === "active_concerning"
      ? "warning"
      : "muted";

  const showFooterNotes =
    (report.confidence === "medium" && highlights.length === 1) ||
    report.evaluation.riskBandZh === "未見負面摘要";
  const showThemes =
    highlights.length > 0 && report.signals.themes.length > 0;
  const bindFailure =
    (report.signals.serpHitCount ?? 0) >= 5 &&
    (report.signals.boundHitCount ?? 0) === 0;
  const showSaturationNote =
    showSaturationBanner && saturationNote && !bindFailure;
  const legalEvents = report.official.legalEvents ?? [];
  const showLegalEvents = legalEvents.length > 0;

  return (
    <div className="space-y-4 text-left">
    <article className={`${reportShellClass} overflow-hidden`}>
      <header
        className="bg-primary px-5 py-5 text-primary-foreground sm:px-6 sm:py-6"
      >
        <p className="text-[11px] font-medium text-primary-foreground/70">
          查證對象
        </p>
        <h2 className="mt-0.5 text-base font-semibold leading-snug sm:text-lg">
          {report.entity.displayName}
        </h2>

        <div className="mt-4 border-t border-primary-foreground/15 pt-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary-foreground">
            <Gauge className="size-4 shrink-0" aria-hidden />
            風險參考分檔
          </p>
          <p
            className={`mt-2 text-2xl leading-tight tracking-tight sm:text-[1.65rem] ${riskBandMeterActiveLabelClass(report.evaluation.riskBandZh, true)}`}
          >
            {bandDetail ?? report.evaluation.riskBandZh}
          </p>
          <RiskBandMeter
            bandZh={report.evaluation.riskBandZh}
            emphasized
          />
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-[1.6] text-primary-foreground/75 sm:text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              置信度{confidenceLabelZh(report.evaluation.confidence)} ·
              公開資料摘要，非信貸報告或聘用建議
            </span>
          </p>
        </div>

        <div
          className="mt-4 border-t border-primary-foreground/15 pt-4"
          aria-labelledby="summary-heading"
        >
          <p
            id="summary-heading"
            className="flex items-center gap-2 text-sm font-semibold text-primary-foreground"
          >
            <FileText className="size-4 shrink-0" aria-hidden />
            查證摘要
          </p>
          <div
            className="mt-3 flex flex-wrap gap-2"
            aria-label="官方資質與糾紛及投訴歷史"
          >
            {mwcRegistryHref ? (
              <a
                href={mwcRegistryHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`${licenseChipClass} transition-colors hover:bg-primary-foreground/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/45`}
              >
                <BadgeCheck className="size-3 shrink-0" aria-hidden />
                {license.label}
                <ExternalLink
                  className="size-3 shrink-0 opacity-80"
                  aria-hidden
                />
                <span className="sr-only">（屋宇署公開名冊，新開啟）</span>
              </a>
            ) : (
              <span className={licenseChipClass}>
                <BadgeCheck className="size-3 shrink-0" aria-hidden />
                {license.label}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${heroChipToneClass(disputeTone)}`}
            >
              <MessageSquare className="size-3 shrink-0" aria-hidden />
              {disputeChip(report)}
            </span>
          </div>
          <p className="mt-3 text-sm leading-[1.7] text-primary-foreground/90 sm:text-[15px]">
            {report.summaryZh}
          </p>
          {showSaturationNote ? (
            <p
              className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200/50 bg-amber-50/95 px-3 py-2.5 text-sm leading-[1.65] text-amber-950"
              role="status"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-amber-800" aria-hidden />
              <span>{saturationNote}</span>
            </p>
          ) : null}
          {showThemes ? (
            <p className="mt-3 text-xs leading-[1.65] text-primary-foreground/75 sm:text-[13px]">
              <span className="font-medium text-primary-foreground/90">主題：</span>
              {report.signals.themes.join("、")}
            </p>
          ) : null}
        </div>

        {officialRegister ? (
          <div className="mt-4 border-t border-primary-foreground/15 pt-3">
            <p
              id="scope-heading"
              className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground/75"
            >
              <ScanSearch className="size-3.5 shrink-0" aria-hidden />
              政府名冊
            </p>
            {mwcRegistryHref ? (
              <a
                href={mwcRegistryHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs leading-relaxed text-primary-foreground/90 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/45"
              >
                {officialRegister.companyName}
                {officialRegister.registrationNo
                  ? `（${officialRegister.registrationNo}）`
                  : ""}
                <ExternalLink className="size-3 shrink-0 opacity-80" aria-hidden />
                <span className="sr-only">於屋宇署公開名冊查閱</span>
              </a>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-primary-foreground/85">
                {officialRegister.companyName}
                {officialRegister.registrationNo
                  ? `（${officialRegister.registrationNo}）`
                  : ""}
              </p>
            )}
            {officialRegister.expiryDate ? (
              <p className="mt-1.5 text-xs leading-relaxed text-primary-foreground/85">
                名冊記錄屆滿日：
                {formatMwcExpiryDateZh(officialRegister.expiryDate)}
                {isMwcExpiryBeforeReport(
                  officialRegister.expiryDate,
                  report.generatedAt,
                ) ? (
                  <span className="mt-1 block text-primary-foreground/75">
                    匯入資料顯示屆滿日已過，請以屋宇署即時名冊核實是否仍有效。
                  </span>
                ) : null}
              </p>
            ) : null}
            {officialRegister.authorizedSignatory ? (
              <p className="mt-1 text-xs leading-relaxed text-primary-foreground/85">
                獲授權簽署人：{officialRegister.authorizedSignatory}
              </p>
            ) : null}
            {officialRegister.registryDataAsOf ? (
              <p className="mt-2 text-[10px] leading-relaxed text-primary-foreground/60">
                名冊摘錄截至{" "}
                <time dateTime={officialRegister.registryDataAsOf}>
                  {formatReportGeneratedAtHkt(
                    officialRegister.registryDataAsOf,
                  )}
                </time>
                ；請以屋宇署連結核對。
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 border-t border-primary-foreground/15 pt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground/75">
            <Link2 className="size-3.5 shrink-0" aria-hidden />
            一鍵查證（外部連結）
          </p>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-primary-foreground/85 sm:text-xs">
            {(() => {
              const links = buildJudiciaryDeepLinks(
                report.entity.searchLabelUsed,
              );
              return (
                <>
                  <li>
                    <a
                      href={links.lrsPartiesSearch}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      司法機構法律參考（訴訟方搜尋）
                    </a>
                  </li>
                  <li>
                    <a
                      href={links.hkliiSearch}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      HKLII 站內搜尋
                    </a>
                  </li>
                  <li>
                    <a
                      href={links.dailyCauseListSearch}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      司法機構每日排期表
                    </a>
                    <span className="mt-0.5 block text-primary-foreground/60">
                      {links.dailyCauseListNote}
                    </span>
                  </li>
                </>
              );
            })()}
          </ul>
        </div>

        <p className="mt-4 border-t border-primary-foreground/15 pt-3 text-[11px] leading-[1.6] text-primary-foreground/65 sm:text-xs">
          生成時間{" "}
          <time dateTime={report.generatedAt}>
            {formatReportGeneratedAtHkt(report.generatedAt)}
          </time>
        </p>
      </header>

      {showLegalEvents ? (
        <ReportBlock
          id="legal-events-heading"
          icon={FileText}
          title={`公開判詞紀錄（${legalEvents.length} 宗）`}
        >
          {legalEvents.some((ev) =>
            hearingSummaryPendingForEvent(
              ev.hearingKeyPointsZh,
              ev.reviewStatus,
            ),
          ) ? (
            <p className={`${reportMetaClass} -mt-1 mb-3`}>
              {LEGAL_EVENTS_FACTS_ONLY_ZH}
            </p>
          ) : (
            <p className={`${reportMetaClass} -mt-1 mb-3`}>
              {LEGAL_EVENTS_SCOPE_ZH}
            </p>
          )}
          <ul className="list-none space-y-0 p-0">
            {legalEvents.map((ev) => {
              const factsOnly = hearingSummaryPendingForEvent(
                ev.hearingKeyPointsZh,
                ev.reviewStatus,
              );
              return (
                <li
                  key={`${ev.caseRef}-${ev.sourceUrl}`}
                  className={reportListRowClass}
                >
                  <p className="text-sm font-semibold text-foreground sm:text-[15px]">
                    {ev.caseRef}
                  </p>
                  {ev.businessForm === "sole_proprietorship" &&
                  ev.defendantDisplayNameZh ? (
                    <p className={`mt-1.5 flex flex-wrap items-center gap-2 ${reportBodyClass}`}>
                      <span className="font-medium text-foreground">
                        {ev.defendantDisplayNameZh}
                      </span>
                      <span
                        className="inline-flex rounded-full border border-muted-foreground/25 bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        獨資經營
                      </span>
                    </p>
                  ) : null}
                  <p className={`mt-1.5 ${reportMetaClass}`}>
                    {ev.court} ·{" "}
                    <time dateTime={ev.eventDate}>{ev.eventDate}</time>
                    {" · "}
                    {partyRoleLabelZh(ev.partyRole)}
                    {" · "}
                    {judgmentCategoryLabelZh(ev.judgmentCategory)}
                  </p>
                  {!factsOnly ? (
                    <>
                      {ev.hearingPointsSource === "llm_draft" ||
                      ev.hearingPointsSource === "ai_verified" ? (
                        <p className={`mt-2 ${reportMetaClass}`}>
                          {LEGAL_EVENTS_AUTO_SUMMARY_ZH}
                        </p>
                      ) : null}
                      <ul
                        className={`mt-2 list-disc space-y-1 pl-5 marker:text-primary/40 ${reportBodyClass} text-muted-foreground`}
                      >
                        {ev.hearingKeyPointsZh.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <a
                    href={ev.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    司法機構刊憲連結
                  </a>
                  <p className={`mt-1.5 ${reportMetaClass}`}>
                    {ev.matchReasonZh}
                  </p>
                </li>
              );
            })}
          </ul>
          {report.official.legalRegistryAsOf ? (
            <p className={`mt-3 ${reportMetaClass}`}>
              判詞庫摘錄截至{" "}
              <time dateTime={report.official.legalRegistryAsOf}>
                {formatReportGeneratedAtHkt(report.official.legalRegistryAsOf)}
              </time>
            </p>
          ) : null}
        </ReportBlock>
      ) : null}

      {evidenceCount > 0 && highlights.length === 0 && (
        <ReportBlock
          id="retrieval-evidence-heading"
          icon={Link2}
          title={`相關公開連結（${evidenceCount} 條）`}
        >
          <p className={`${reportMetaClass} -mt-1 mb-3`}>
            本次未形成討論摘要，以下連結供自行閱讀核實。
          </p>
          <ul className="list-none space-y-0 p-0">
            {report.signals.retrievalEvidence!.map((item) => (
              <li key={item.url} className={reportListRowClass}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-2 font-medium text-primary underline-offset-2 hover:underline break-all"
                >
                  <ExternalLink
                    className="mt-1 size-4 shrink-0"
                    aria-hidden
                  />
                  <span className="text-sm leading-snug sm:text-[15px]">
                    {item.title || item.url}
                  </span>
                </a>
                {item.snippetExcerpt ? (
                  <p className={`mt-2 ${reportMetaClass}`}>
                    {item.snippetExcerpt}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </ReportBlock>
      )}

      {actionable.length > 0 && (
        <ReportBlock
          id="actionable-heading"
          icon={ShieldCheck}
          title="簽約防守建議（依本案公開資料）"
        >
          <ul className="list-none space-y-0 p-0">
            {actionable.map((item, i) => (
              <li
                key={`${item.category}-${i}`}
                className={reportListRowClass}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {item.category}
                </p>
                <p className={`mt-1.5 ${reportBodyClass}`}>{item.clauseText}</p>
                <p className={`mt-2 ${reportMetaClass}`}>{item.reason}</p>
              </li>
            ))}
          </ul>
        </ReportBlock>
      )}

      {showFooterNotes ? (
        <footer
          className={`${reportBlockClass} ${reportBlockDividerClass} space-y-4`}
        >
          {report.confidence === "medium" && highlights.length === 1 && (
            <p className="flex items-start gap-2 text-muted-foreground">
              <CircleHelp
                className="mt-0.5 size-4 shrink-0 text-primary/70"
                aria-hidden
              />
              <span className={reportBodyClass}>
                目前僅找到少量公開來源摘要，請自行核實是否與本次查詢對象為同一商號。
              </span>
            </p>
          )}

          {report.evaluation.riskBandZh === "未見負面摘要" && (
            <p
              className={`rounded-lg px-3 py-2.5 ${reportBodyClass} text-muted-foreground ${riskBandSurfaceClass("未見負面摘要")}`}
            >
              「未見負面摘要」僅表示在本次檢索範圍內的公開討論摘要中，出現讚揚相關表述且未見糾紛相關表述；不包括未收錄來源，並不構成品質保證或聘用建議。
            </p>
          )}
        </footer>
      ) : null}
    </article>

    {highlights.length > 0 && (
      <div
        className="space-y-3"
        role="region"
        aria-labelledby="highlights-heading"
      >
        <h3
          id="highlights-heading"
          className={`${reportSectionTitleClass} flex items-center gap-2 px-1 sm:px-0`}
        >
          <MessageSquare className="size-[1.125rem] shrink-0 text-primary/75" aria-hidden />
          公開討論摘要（{report.signals.discussionCount} 則）
        </h3>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {highlights.map((h, index) => {
            const titleId = `highlight-title-${index}`;
            const title = highlightCardTitle(h);
            const body = highlightCardBody(h);
            const when = simplifyHighlightWhen(h);
            const source = h.sourceName?.trim();
            return (
              <section
                key={h.url}
                className={`${reportShellClass} relative flex h-full min-w-0 flex-col overflow-hidden px-3 pb-3 pt-5 sm:px-5 sm:pb-5 sm:pt-6`}
                aria-labelledby={titleId}
              >
                {source ? (
                  <span
                    className={`pointer-events-none absolute right-0 top-0 z-[1] inline-flex max-w-[62%] items-center truncate rounded-bl-xl rounded-tr-2xl px-2 py-1 text-[9px] font-bold leading-none tracking-wide sm:px-2.5 sm:py-1.5 sm:text-[10px] ${sourceBadgeAppearance(source, h.url)}`}
                    aria-hidden
                  >
                    {sourceBadgeLabel(source, h.url)}
                  </span>
                ) : null}
                <a
                  id={titleId}
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full line-clamp-3 text-[12px] font-semibold leading-snug text-primary underline-offset-2 hover:underline sm:text-sm"
                  title={title}
                >
                  {title}
                </a>
                {when ? (
                  <p className="mt-2 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                    {when}
                  </p>
                ) : null}
                {body ? (
                  <p
                    className={`mt-2 flex-1 ${reportMetaClass} line-clamp-3 sm:line-clamp-4`}
                    title={body}
                  >
                    {body}
                  </p>
                ) : (
                  <div className="flex-1" aria-hidden />
                )}
                {h.incidentType ? (
                  <p className="mt-auto pt-2 text-[10px] font-medium text-primary/75 sm:text-[11px]">
                    {incidentHashtag(h.incidentType)}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
        <p className={`px-1 ${reportMetaClass} sm:px-0`}>
          請點擊摘要標題開啟來源，並確認是否同一商號及內容是否與本次查證對象相關；不等同法律定論。
        </p>
      </div>
    )}

    {checklist.length > 0 && (
      <section
        className={`${reportShellClass} ${reportBlockClass}`}
        aria-labelledby="checklist-heading"
      >
        <SectionHeading id="checklist-heading" icon={ListChecks}>
          {actionable.length > 0 ? "通用簽約提問" : "簽約前可參考提問"}
        </SectionHeading>
        <ul
          className={`mt-4 list-disc space-y-2 pl-5 marker:text-primary/40 ${reportBodyClass} text-muted-foreground`}
        >
          {checklist.map((item) => (
            <li key={item} className="pl-1">{item}</li>
          ))}
        </ul>
      </section>
    )}

    <aside
      className="px-1 py-2 sm:px-0"
      aria-label="報告免責"
    >
      <p className="flex items-start gap-1.5 text-[11px] leading-[1.6] text-muted-foreground sm:text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0 text-primary/60" aria-hidden />
        <span>
          本報告為公開資料摘要及風險參考分檔，非信貸報告，非對承辦商的推薦。
        </span>
      </p>
    </aside>
    </div>
  );
}
