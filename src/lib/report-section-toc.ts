import {
  CONTRACT_CHECKLIST_HEADING_WITH_ACTIONABLE_ZH,
  CONTRACT_CHECKLIST_HEADING_ZH,
  CR_IDENTITY_CARD_HEADING_ZH,
  MWC_MISS_NOTE_HEADING_ZH,
  NEXT_STEPS_HEADING_ZH,
  NON_LIMITED_NOTICE_HEADING_ZH,
  OFFICIAL_VERIFY_SECTION_HEADING_ZH,
  REPORT_SCOPE_LIMITS_HEADING_ZH,
  UNVERIFIED_COMPANY_REGISTRATION_ALERT_HEADING_ZH,
} from "@/lib/report-trust-copy-zh";
import { isReportLegalLookupDegraded } from "@/lib/report-card-legal-degraded-ui";
import { shouldShowNonLimitedContractorNotice } from "@/lib/non-limited-contractor-notice";
import {
  shouldShowMwcMissFallbackNote,
  shouldShowMwcMissWithCrFoundNote,
  shouldShowUnverifiedCompanyRegistrationAlert,
} from "@/lib/unverified-company-registration";
import type { RiskReport } from "@/lib/report-schema";

export type ReportTocEntry = { id: string; label: string };

export function buildReportTocEntries(report: RiskReport): ReportTocEntry[] {
  const entries: ReportTocEntry[] = [];
  const highlights = report.signals.highlights ?? [];
  const legalEvents = report.official.legalEvents ?? [];
  const actionable = report.signals.actionableClauses ?? [];
  const evidenceCount = report.signals.retrievalEvidence?.length ?? 0;

  if (shouldShowUnverifiedCompanyRegistrationAlert(report)) {
    entries.push({
      id: "unverified-registration-heading",
      label: UNVERIFIED_COMPANY_REGISTRATION_ALERT_HEADING_ZH,
    });
  }

  const cr = report.official.companiesRegistry;
  if (cr && cr.lookupStatus !== "skipped") {
    entries.push({
      id: "cr-identity-heading",
      label: CR_IDENTITY_CARD_HEADING_ZH,
    });
  }

  if (shouldShowMwcMissWithCrFoundNote(report)) {
    entries.push({
      id: "mwc-miss-note-heading",
      label: MWC_MISS_NOTE_HEADING_ZH,
    });
  }

  if (shouldShowMwcMissFallbackNote(report)) {
    entries.push({
      id: "mwc-miss-fallback-heading",
      label: MWC_MISS_NOTE_HEADING_ZH,
    });
  }

  if (shouldShowNonLimitedContractorNotice(report)) {
    entries.push({
      id: "non-limited-notice-heading",
      label: NON_LIMITED_NOTICE_HEADING_ZH,
    });
  }

  if (legalEvents.length > 0) {
    entries.push({
      id: "legal-events-heading",
      label: `公開判詞紀錄（${legalEvents.length} 宗）`,
    });
  } else if (isReportLegalLookupDegraded(report)) {
    entries.push({
      id: "legal-events-heading",
      label: "公開判詞紀錄",
    });
  }

  if (evidenceCount > 0 && highlights.length === 0) {
    entries.push({
      id: "retrieval-evidence-heading",
      label: `相關公開連結（${evidenceCount} 條）`,
    });
  }

  if (actionable.length > 0) {
    entries.push({
      id: "actionable-heading",
      label: "簽約防守建議（依本案公開資料）",
    });
  }

  if (highlights.length > 0) {
    entries.push({
      id: "highlights-heading",
      label: `公開討論摘要（${report.signals.discussionCount} 則）`,
    });
  }

  entries.push({
    id: "checklist-heading",
    label:
      actionable.length > 0
        ? CONTRACT_CHECKLIST_HEADING_WITH_ACTIONABLE_ZH
        : CONTRACT_CHECKLIST_HEADING_ZH,
  });
  entries.push({
    id: "next-steps-heading",
    label: NEXT_STEPS_HEADING_ZH,
  });
  entries.push({
    id: "report-limits-heading",
    label: REPORT_SCOPE_LIMITS_HEADING_ZH,
  });
  entries.push({
    id: "official-verify-heading",
    label: OFFICIAL_VERIFY_SECTION_HEADING_ZH,
  });

  return entries;
}
