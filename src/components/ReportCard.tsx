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
import { DailyCauseListSearchForm } from "@/components/DailyCauseListSearchForm";
import { buildJudiciaryDeepLinks } from "@/lib/judiciary-search-deep-links";
import { CompanyIdentityCard } from "@/components/CompanyIdentityCard";
import { LegalEventsTable } from "@/components/LegalEventsTable";
import { buildOfficialVerifyLinks } from "@/lib/official-verify-links";
import { shouldShowNonLimitedContractorNotice } from "@/lib/non-limited-contractor-notice";
import {
  BD_EXEMPTED_WORKS_URL,
  BD_MINOR_WORKS_OFFICIAL_URL,
  CONTRACT_CHECKLIST_HEADING_WITH_ACTIONABLE_ZH,
  CONTRACT_CHECKLIST_HEADING_ZH,
  DEFAULT_CONTRACT_CHECKLIST_ZH,
  DAILY_CAUSE_LIST_SELF_SERVICE_BODY_ZH,
  DAILY_CAUSE_LIST_SELF_SERVICE_HEADING_ZH,
  NEXT_STEPS_HEADING_ZH,
  NEXT_STEPS_INTRO_ZH,
  NEXT_STEPS_ITEMS,
  NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH,
  NON_LIMITED_CONTRACTOR_NOTICE_ZH,
  NON_LIMITED_NOTICE_HEADING_ZH,
  OFFICIAL_VERIFY_SECTION_HEADING_ZH,
  REPORT_SCOPE_LIMITS_BULLETS_ZH,
  REPORT_SCOPE_LIMITS_CLOSING_ZH,
  REPORT_SCOPE_LIMITS_HEADING_ZH,
  CR_DATA_ATTRIBUTION_ZH,
  THIRD_PARTY_REDACTION_NOTICE_ZH,
  mwcMissFallbackBodyParagraphsZh,
  MWC_MISS_EXEMPT_ENGINEERING_PARAGRAPH_ZH,
  MWC_MISS_NOTE_HEADING_ZH,
  UNVERIFIED_COMPANY_REGISTRATION_ALERT_BODY_PARAGRAPHS_ZH,
  UNVERIFIED_COMPANY_REGISTRATION_ALERT_HEADING_ZH,
  UNVERIFIED_COMPANY_REGISTRATION_EXEMPTED_LINK_LABEL_ZH,
  UNVERIFIED_COMPANY_REGISTRATION_SEE_NEXT_STEPS_ZH,
  mwcMissNoteBodyParagraphsZh,
} from "@/lib/report-trust-copy-zh";
import {
  shouldShowMwcMissFallbackNote,
  shouldShowMwcMissWithCrFoundNote,
  shouldShowUnverifiedCompanyRegistrationAlert,
} from "@/lib/unverified-company-registration";
import {
  LEGAL_LOOKUP_DEGRADED_SECTION_ZH,
  LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX,
} from "@/lib/legal-event-display";
import {
  isReportLegalLookupDegraded,
  reportCardHeaderBandLabel,
  reportCardHeaderRiskBandZh,
  reportCardShowFooterNotes,
  reportCardShowRiskBandFooterNote,
} from "@/lib/report-card-legal-degraded-ui";
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
import { surfaceCardClass as reportShellClass } from "@/lib/ui-surfaces";
import {
  reportBlockPaddingClass,
  reportBodyTextClass,
  reportExternalLinkTouchClass,
  reportH1Class,
  reportH2SectionClass,
  reportHeroBodyClass,
  reportHeroChipClass,
  reportHeroMetaClass,
  reportHighlightGridClass,
  reportHighlightLastOddClass,
  reportListItemGapClass,
  reportMajorGroupGapClass,
  reportMetaTextClass,
  reportRiskBandDisplayClass,
  reportSectionStackClass,
  reportTitleToContentClass,
} from "@/lib/report-tokens";
import { legalEventsPanelClass, reportReadingColumnClass } from "./report-column";
import {
  forumDisputeChip,
  heroForumChipTone,
  heroLegalChipTone,
  legalRecordsChip,
} from "@/lib/report-hero-summary";
import {
  ratedDisputeHighlightCount,
  riskBandRationaleLineZh,
} from "@/lib/report-risk-band-rationale";
import { RiskBandMeter } from "./RiskBandMeter";
import { redactFeedbackComment } from "@/lib/feedback/redact";

/** Third-party SERP text: strip phones, emails, HKID, addresses, honorific names before display. */
function redactEvidenceText(text: string): string {
  return redactFeedbackComment(text);
}

function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "公開連結";
  }
}

function confidenceLabelZh(confidence: RiskReport["confidence"]): string {
  if (confidence === "high") return "較高";
  if (confidence === "medium") return "中等";
  return "較低";
}

/** Shown in 查證摘要 when the signal filter left no public links. */
const EMPTY_FILTERED_DISCUSSION_ZH = "今次未搵到有實質內容嘅公開討論。";

function displayedSummaryZh(
  report: RiskReport,
  evidenceCount: number,
): string {
  const highlights = report.signals.highlights ?? [];
  const filteredEmpty =
    highlights.length === 0 &&
    evidenceCount === 0 &&
    (report.signals.boundHitCount ?? 0) > 0;
  if (!filteredEmpty) return report.summaryZh;
  // The judgment block says 「詳見上方說明」 and points at this prefix.
  if (report.summaryZh.startsWith(LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX)) {
    return `${LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX}${EMPTY_FILTERED_DISCUSSION_ZH}`;
  }
  return EMPTY_FILTERED_DISCUSSION_ZH;
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

function heroChipToneClass(tone: "primary" | "warning" | "muted"): string {
  if (tone === "warning") {
    return "border-amber-200/60 bg-amber-50/95 text-amber-950";
  }
  if (tone === "primary") {
    return "border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground";
  }
  return "border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground";
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

const reportBlockClass = reportBlockPaddingClass;

const reportBlockDividerClass =
  "border-t border-border/60 first:border-t-0";

const reportSectionTitleClass = reportH2SectionClass;

const reportBodyClass = reportBodyTextClass;

const reportMetaClass = reportMetaTextClass;

const reportListRowClass =
  `border-b border-border/50 py-4 last:border-b-0 last:pb-0 first:pt-0 ${reportListItemGapClass}`;

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
    <h2
      id={id}
      className={`${reportSectionTitleClass} flex items-center gap-2.5`}
    >
      <Icon className="size-[1.125rem] shrink-0 text-primary/75" aria-hidden />
      {children}
    </h2>
  );
}

function ReportExternalLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center ${reportExternalLinkTouchClass} ${className ?? ""}`}
    >
      {children}
      <ExternalLink className="ms-1 inline size-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="sr-only">（新分頁開啟）</span>
    </a>
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
      <div className={reportTitleToContentClass}>{children}</div>
    </section>
  );
}

export function ReportCard({
  report,
  onOfficialLinkClick,
}: {
  report: RiskReport;
  onOfficialLinkClick?: () => void;
}) {
  const highlights = report.signals.highlights ?? [];
  const contractQuestions = DEFAULT_CONTRACT_CHECKLIST_ZH;
  const actionable = report.signals.actionableClauses ?? [];
  const companiesRegistry = report.official.companiesRegistry;
  const showCrRegistrationAlert =
    shouldShowUnverifiedCompanyRegistrationAlert(report);
  const showMwcMissNote = shouldShowMwcMissWithCrFoundNote(report);
  const showMwcMissFallbackNote = shouldShowMwcMissFallbackNote(report);
  const mwcMissNoteParagraphs = mwcMissNoteBodyParagraphsZh(
    companiesRegistry?.matchTier,
  );
  const showNonLimitedNotice = shouldShowNonLimitedContractorNotice(report);
  const officialVerifyLinks = buildOfficialVerifyLinks(report);
  const saturation = report.evaluation.dataSaturation;
  const saturationNote = dataSaturationCaution(saturation);
  const evidenceCount = report.signals.retrievalEvidence?.length ?? 0;
  const heroSummary = displayedSummaryZh(report, evidenceCount);
  const showSaturationBanner =
    saturation === "unindexed" ||
    // Moderate copy points at the link list. Hide it when that list was filtered empty.
    (saturation === "moderate" &&
      highlights.length === 0 &&
      evidenceCount > 0);
  const officialRegister = report.official.details;
  const license = licenseStatusChip(report);
  const mwcRegistryHref = mwcRegistrySearchHref(report);
  const licenseChipClass = `${reportHeroChipClass} ${heroChipToneClass(license.tone)}`;
  const disputeTone =
    report.evaluation.reputationTrack.disputeLevel === "severe" ||
    report.evaluation.reputationTrack.disputeLevel === "active_concerning"
      ? "warning"
      : "muted";
  const forumHeroChip = forumDisputeChip(report);
  const forumHeroTone = heroForumChipTone(report, disputeTone);
  const legalHeroChip = legalRecordsChip(report);
  const legalHeroTone = heroLegalChipTone(report, disputeTone);
  const forumHeroChipClass = `${reportHeroChipClass} ${heroChipToneClass(forumHeroTone)}`;
  const legalHeroChipClass = `${reportHeroChipClass} ${heroChipToneClass(legalHeroTone)}`;

  const legalLookupDegraded = isReportLegalLookupDegraded(report);
  const showFooterNotes = reportCardShowFooterNotes(
    report,
    highlights.length,
  );
  const showThemes =
    highlights.length > 0 && report.signals.themes.length > 0;
  const bindFailure =
    (report.signals.serpHitCount ?? 0) >= 5 &&
    (report.signals.boundHitCount ?? 0) === 0;
  const showSaturationNote =
    showSaturationBanner && saturationNote && !bindFailure;
  const legalEvents = report.official.legalEvents ?? [];
  const showLegalEvents = legalEvents.length > 0;
  const showLegalLookupDegraded = !showLegalEvents && legalLookupDegraded;
  const headerRiskBandZh = reportCardHeaderRiskBandZh(report);
  const headerBandLabel = reportCardHeaderBandLabel(report);
  const ratedDisputeN = ratedDisputeHighlightCount(report);
  const showArticleTail =
    evidenceCount > 0 ||
    actionable.length > 0 ||
    showFooterNotes;

  function afterLegalEventsBody(): ReactNode {
    return (
      <>
      {evidenceCount > 0 && (
        <ReportBlock
          id="retrieval-evidence-heading"
          icon={Link2}
          title={`相關公開連結（${evidenceCount} 條）`}
        >
          {highlights.length === 0 ? (
            <p className={`${reportMetaClass} -mt-1 mb-3`}>
              本次未形成討論摘要，以下連結供自行閱讀核實。
            </p>
          ) : null}
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
                    {item.title ? redactEvidenceText(item.title) : siteLabel(item.url)}
                  </span>
                </a>
                {item.snippetExcerpt && highlights.length === 0 ? (
                  <p className={`mt-2 ${reportMetaClass}`}>
                    {redactEvidenceText(item.snippetExcerpt)}
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

          {reportCardShowRiskBandFooterNote(report) && (
            <p
              className={`rounded-lg px-3 py-2.5 ${reportBodyClass} text-muted-foreground ${riskBandSurfaceClass("未見負面摘要")}`}
            >
              「未見負面摘要」僅表示在本次檢索範圍內的公開討論摘要中，出現讚揚相關表述且未見糾紛相關表述；不包括未收錄來源，並不構成品質保證或聘用建議。
            </p>
          )}
        </footer>
      ) : null}
      </>
    );
  }

  return (
    <div className={`${reportMajorGroupGapClass} text-left`}>
    <div className={`${reportReadingColumnClass} ${reportSectionStackClass}`}>
    {showCrRegistrationAlert ? (
      <div
        className="rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm sm:px-5 sm:py-5"
        role="alert"
        aria-labelledby="unverified-registration-heading"
      >
        <h2
          id="unverified-registration-heading"
          className="text-base font-semibold leading-snug sm:text-lg"
        >
          {UNVERIFIED_COMPANY_REGISTRATION_ALERT_HEADING_ZH}
        </h2>
        <div className="mt-3 space-y-2 text-sm leading-[1.65] sm:text-[15px]">
          {UNVERIFIED_COMPANY_REGISTRATION_ALERT_BODY_PARAGRAPHS_ZH.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p>{MWC_MISS_EXEMPT_ENGINEERING_PARAGRAPH_ZH}</p>
          <p className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4">
            <ReportExternalLink
              href={BD_MINOR_WORKS_OFFICIAL_URL}
              className="inline-flex items-center font-medium text-amber-950 underline-offset-2 hover:underline"
            >
              {NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH}
            </ReportExternalLink>
            <ReportExternalLink
              href={BD_EXEMPTED_WORKS_URL}
              className="inline-flex items-center font-medium text-amber-950 underline-offset-2 hover:underline"
            >
              {UNVERIFIED_COMPANY_REGISTRATION_EXEMPTED_LINK_LABEL_ZH}
            </ReportExternalLink>
          </p>
          <p className="text-amber-900/85 text-xs sm:text-sm">
            {CR_DATA_ATTRIBUTION_ZH}
          </p>
          <p className="text-amber-900/90">
            {UNVERIFIED_COMPANY_REGISTRATION_SEE_NEXT_STEPS_ZH}
          </p>
        </div>
      </div>
    ) : null}
    <article className={`${reportShellClass} overflow-hidden`}>
      <header
        className="bg-primary px-5 py-5 text-primary-foreground sm:px-6 sm:py-6"
      >
        <p className={`${reportHeroMetaClass} font-medium`}>
          查證對象
        </p>
        <h1 className={`mt-0.5 ${reportH1Class}`}>
          {report.entity.displayName}
        </h1>

        <div className="mt-4 border-t border-primary-foreground/15 pt-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary-foreground">
            <Gauge className="size-4 shrink-0" aria-hidden />
            風險參考分檔
          </p>
          <p
            className={`mt-2 ${reportRiskBandDisplayClass} ${riskBandMeterActiveLabelClass(headerRiskBandZh, true)}`}
          >
            {headerBandLabel}
          </p>
          <RiskBandMeter
            bandZh={headerRiskBandZh}
            emphasized
          />
          {ratedDisputeN > 0 &&
          (headerRiskBandZh === "風險偏高" || headerRiskBandZh === "風險中等") ? (
            <p className="mt-2 text-xs leading-snug text-primary-foreground/85 sm:text-sm">
              <a
                href="#highlights-heading"
                className="underline underline-offset-2 hover:text-primary-foreground"
              >
                {riskBandRationaleLineZh(ratedDisputeN)}
              </a>
            </p>
          ) : null}
          <p className={`mt-3 flex items-start gap-2 ${reportHeroMetaClass}`}>
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
                className={`${licenseChipClass} min-h-11 transition-colors hover:bg-primary-foreground/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/45`}
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
            <span className={forumHeroChipClass}>
              <MessageSquare className="size-3 shrink-0" aria-hidden />
              {forumHeroChip.label}
            </span>
            {legalHeroChip ? (
              <span className={legalHeroChipClass}>
                <FileText className="size-3 shrink-0" aria-hidden />
                {legalHeroChip.label}
              </span>
            ) : null}
          </div>
          <p className={`mt-3 ${reportHeroBodyClass}`}>
            {heroSummary}
          </p>
          <p className={`mt-3 ${reportHeroMetaClass}`} role="note">
            {THIRD_PARTY_REDACTION_NOTICE_ZH}
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
            <p className={`mt-3 ${reportHeroMetaClass}`}>
              <span className="font-medium text-primary-foreground/90">主題：</span>
              {report.signals.themes.join("、")}
            </p>
          ) : null}
        </div>

        {officialRegister ? (
          <div className="mt-4 border-t border-primary-foreground/15 pt-3">
            <p
              id="scope-heading"
              className={`flex items-center gap-1.5 text-xs font-medium text-primary-foreground/80 lg:text-sm`}
            >
              <ScanSearch className="size-3.5 shrink-0" aria-hidden />
              政府名冊
            </p>
            {mwcRegistryHref ? (
              <a
                href={mwcRegistryHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-2 inline-flex items-center gap-1 text-xs leading-relaxed text-primary-foreground/90 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/45 ${reportExternalLinkTouchClass}`}
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
              <p className={`mt-2 ${reportHeroMetaClass}`}>
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
          <ul className={`mt-2 space-y-1.5 ${reportHeroMetaClass}`}>
            {(() => {
              const links = buildJudiciaryDeepLinks(
                report.entity.searchLabelUsed,
              );
              return (
                <>
                  <li>
                    <ReportExternalLink
                      href={links.lrsPartiesSearch}
                      className={`py-2 underline-offset-2 hover:underline ${reportExternalLinkTouchClass}`}
                    >
                      司法機構法律參考（訴訟方搜尋）
                    </ReportExternalLink>
                  </li>
                  <li>
                    <ReportExternalLink
                      href={links.hkliiSearch}
                      className={`py-2 underline-offset-2 hover:underline ${reportExternalLinkTouchClass}`}
                    >
                      HKLII 站內搜尋
                    </ReportExternalLink>
                  </li>
                  <li>
                    <DailyCauseListSearchForm
                      partyName={report.entity.searchLabelUsed}
                    />
                    <span className="mt-0.5 block text-primary-foreground/80">
                      {links.dailyCauseListNote}
                    </span>
                  </li>
                </>
              );
            })()}
          </ul>
        </div>

        <p className={`mt-4 border-t border-primary-foreground/15 pt-3 ${reportHeroMetaClass}`}>
          生成時間{" "}
          <time className="tabular-nums" dateTime={report.generatedAt}>
            {formatReportGeneratedAtHkt(report.generatedAt)}
          </time>
        </p>
      </header>

      <CompanyIdentityCard report={report} />

      {showMwcMissNote ? (
        <ReportBlock
          id="mwc-miss-note-heading"
          icon={Info}
          title={MWC_MISS_NOTE_HEADING_ZH}
          className="bg-muted/20"
        >
          <div className={`${reportBodyClass} space-y-2`} role="note">
            {mwcMissNoteParagraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="text-muted-foreground text-xs sm:text-sm">
              {CR_DATA_ATTRIBUTION_ZH}
            </p>
            <p className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4">
              <ReportExternalLink
                href={BD_MINOR_WORKS_OFFICIAL_URL}
                className="inline-flex items-center font-medium text-primary underline-offset-2 hover:underline"
              >
                {NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH}
              </ReportExternalLink>
              <ReportExternalLink
                href={BD_EXEMPTED_WORKS_URL}
                className="inline-flex items-center font-medium text-primary underline-offset-2 hover:underline"
              >
                {UNVERIFIED_COMPANY_REGISTRATION_EXEMPTED_LINK_LABEL_ZH}
              </ReportExternalLink>
            </p>
          </div>
        </ReportBlock>
      ) : null}

      {showMwcMissFallbackNote ? (
        <ReportBlock
          id="mwc-miss-fallback-heading"
          icon={Info}
          title={MWC_MISS_NOTE_HEADING_ZH}
          className="bg-muted/20"
        >
          <div className={`${reportBodyClass} space-y-2`} role="note">
            {mwcMissFallbackBodyParagraphsZh(
              companiesRegistry?.lookupStatus,
            ).map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4">
              <ReportExternalLink
                href={BD_MINOR_WORKS_OFFICIAL_URL}
                className="inline-flex items-center font-medium text-primary underline-offset-2 hover:underline"
              >
                {NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH}
              </ReportExternalLink>
              <ReportExternalLink
                href={BD_EXEMPTED_WORKS_URL}
                className="inline-flex items-center font-medium text-primary underline-offset-2 hover:underline"
              >
                {UNVERIFIED_COMPANY_REGISTRATION_EXEMPTED_LINK_LABEL_ZH}
              </ReportExternalLink>
            </p>
          </div>
        </ReportBlock>
      ) : null}

      {showNonLimitedNotice ? (
        <ReportBlock
          id="non-limited-notice-heading"
          icon={Info}
          title={NON_LIMITED_NOTICE_HEADING_ZH}
          className="bg-muted/20"
        >
          <div className={`${reportBodyClass}`} role="note">
            <p>{NON_LIMITED_CONTRACTOR_NOTICE_ZH}</p>
          </div>
        </ReportBlock>
      ) : null}

      {!showLegalEvents && showLegalLookupDegraded ? (
        <ReportBlock
          id="legal-events-heading"
          icon={FileText}
          title="公開判詞紀錄"
        >
          <p className={`${reportMetaClass} -mt-1`}>
            {LEGAL_LOOKUP_DEGRADED_SECTION_ZH}
          </p>
        </ReportBlock>
      ) : null}

      {!showLegalEvents ? afterLegalEventsBody() : null}
    </article>
    </div>

    {showLegalEvents ? (
      <div data-testid="legal-events-panel" className={legalEventsPanelClass}>
        <div className={`${reportShellClass} overflow-hidden`}>
          <LegalEventsTable
            events={legalEvents}
            registryAsOf={report.official.legalRegistryAsOf}
          />
        </div>
      </div>
    ) : null}

    <div className={`${reportReadingColumnClass} ${reportSectionStackClass}`}>
    {showLegalEvents && showArticleTail ? (
      <article className={`${reportShellClass} overflow-hidden`}>
        {afterLegalEventsBody()}
      </article>
    ) : null}

    {highlights.length > 0 && (
      <div
        className="space-y-3"
        role="region"
        aria-labelledby="highlights-heading"
      >
        <h2
          id="highlights-heading"
          className={`${reportSectionTitleClass} flex items-center gap-2 px-1 sm:px-0`}
        >
          <MessageSquare className="size-[1.125rem] shrink-0 text-primary/75" aria-hidden />
          公開討論摘要（{report.signals.discussionCount} 則）
        </h2>
        <div className={reportHighlightGridClass}>
          {highlights.map((h, index) => {
            const isLastOdd =
              highlights.length % 2 === 1 && index === highlights.length - 1;
            const titleId = `highlight-title-${index}`;
            const title = highlightCardTitle(h);
            const body = highlightCardBody(h);
            const when = simplifyHighlightWhen(h);
            const source = h.sourceName?.trim();
            return (
              <section
                key={h.url}
                className={`${reportShellClass} relative flex h-full min-w-0 flex-col overflow-hidden px-5 pb-5 pt-6 lg:px-8 lg:pb-8 lg:pt-8 ${isLastOdd ? reportHighlightLastOddClass : ""}`}
                aria-labelledby={titleId}
              >
                {source ? (
                  <span
                    className={`pointer-events-none absolute right-0 top-0 z-[1] inline-flex max-w-[62%] items-center truncate rounded-bl-xl rounded-tr-2xl px-2.5 py-1.5 text-xs font-bold leading-none tracking-wide ${sourceBadgeAppearance(source, h.url)}`}
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
                  className={`block w-full max-w-[40em] line-clamp-3 text-[15px] font-semibold leading-snug text-primary underline-offset-2 hover:underline lg:text-base ${reportExternalLinkTouchClass}`}
                  title={title}
                >
                  {title}
                </a>
                {when ? (
                  <p className={`mt-2 ${reportMetaClass} tabular-nums`}>
                    {when}
                  </p>
                ) : null}
                {body ? (
                  <p
                    className={`mt-2 max-w-[40em]! flex-1 ${reportMetaClass} line-clamp-3 sm:line-clamp-4`}
                    title={body}
                  >
                    {body}
                  </p>
                ) : (
                  <div className="flex-1" aria-hidden />
                )}
                {h.incidentType ? (
                  <p className={`mt-auto pt-2 text-xs font-medium text-primary lg:text-sm`}>
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

    <section
      className={`${reportShellClass} ${reportBlockClass}`}
      aria-labelledby="checklist-heading"
    >
      <SectionHeading id="checklist-heading" icon={ListChecks}>
        {actionable.length > 0
          ? CONTRACT_CHECKLIST_HEADING_WITH_ACTIONABLE_ZH
          : CONTRACT_CHECKLIST_HEADING_ZH}
      </SectionHeading>
      <ul
        className={`mt-4 list-disc space-y-2 pl-5 marker:text-primary/40 ${reportBodyClass} text-muted-foreground`}
      >
        {contractQuestions.map((item) => (
          <li key={item} className="pl-1">{item}</li>
        ))}
      </ul>
    </section>

    <section
      className={`${reportShellClass} ${reportBlockClass}`}
      aria-labelledby="next-steps-heading"
    >
      <SectionHeading id="next-steps-heading" icon={ListChecks}>
        {NEXT_STEPS_HEADING_ZH}
      </SectionHeading>
      <p className={`mt-3 ${reportMetaClass}`}>{NEXT_STEPS_INTRO_ZH}</p>
      <ol
        className={`mt-4 list-decimal space-y-2 pl-5 marker:text-primary/50 ${reportBodyClass} text-muted-foreground`}
      >
        {NEXT_STEPS_ITEMS.map((item) => (
          <li key={item.text} className="pl-1">
            {item.text}
            {item.link ? (
              <>
                {"（"}
                <ReportExternalLink
                  href={item.link.href}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {item.link.label}
                </ReportExternalLink>
                ）
              </>
            ) : null}
          </li>
        ))}
      </ol>
    </section>

    <section
      className={`${reportShellClass} ${reportBlockClass}`}
      aria-labelledby="report-limits-heading"
    >
      <SectionHeading id="report-limits-heading" icon={CircleHelp}>
        {REPORT_SCOPE_LIMITS_HEADING_ZH}
      </SectionHeading>
      <ul
        className={`mt-4 list-disc space-y-2 pl-5 marker:text-primary/40 ${reportBodyClass} text-muted-foreground`}
      >
        {REPORT_SCOPE_LIMITS_BULLETS_ZH.map((item) => (
          <li key={item} className="pl-1">{item}</li>
        ))}
      </ul>
      <div className="mt-5 rounded-lg border border-border/60 bg-muted/25 px-4 py-4">
        <h3 className="text-sm font-semibold text-foreground">
          {DAILY_CAUSE_LIST_SELF_SERVICE_HEADING_ZH}
        </h3>
        <ul className={`mt-2 list-disc space-y-1.5 pl-5 ${reportMetaClass}`}>
          {DAILY_CAUSE_LIST_SELF_SERVICE_BODY_ZH.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <p className={`mt-4 ${reportMetaClass}`}>
        {REPORT_SCOPE_LIMITS_CLOSING_ZH}
      </p>
    </section>

    <section
      className={`${reportShellClass} ${reportBlockClass}`}
      aria-labelledby="official-verify-heading"
    >
      <SectionHeading id="official-verify-heading" icon={Link2}>
        {OFFICIAL_VERIFY_SECTION_HEADING_ZH}
      </SectionHeading>
      <ul
        className={`mt-3 list-none space-y-2 p-0 ${reportBodyClass} text-muted-foreground`}
      >
        {officialVerifyLinks.map((item) => (
          <li key={item.id}>
            <ReportExternalLink
              href={item.url}
              onClick={onOfficialLinkClick}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {item.labelZh}
            </ReportExternalLink>
            {item.noteZh ? (
              <p className={`mt-1 ${reportMetaClass}`}>{item.noteZh}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>

    <div role="note" className="px-1 py-2 sm:px-0" aria-label="報告免責">
      <p className={`flex items-start gap-1.5 ${reportMetaClass}`}>
        <Info className="mt-0.5 size-3.5 shrink-0 text-primary/60" aria-hidden />
        <span>
          本報告為公開資料摘要及風險參考分檔，非信貸報告，非對承辦商的推薦。
        </span>
      </p>
    </div>
    </div>
    </div>
  );
}
