import { buildBdMwcRegistrySearchUrl } from "./bd-mwc-registry-url";
import type { RiskReport } from "./report-schema";
import {
  BD_MWC_REGISTER_SEARCH_URL,
  BR_ENQUIRY_SELF_SERVICE_NOTE_ZH,
  ICRIS_HOME_URL,
  ICRIS_SELF_SERVICE_NOTE_ZH,
  IRD_BR_ENQUIRY_URL,
  OFFICIAL_VERIFY_LINK_LABELS,
  OFFICIAL_VERIFY_LINK_NOTES,
  ORO_INFO_HOME_URL,
  ORO_SELF_SERVICE_NOTE_ZH,
} from "./report-trust-copy-zh";

export type OfficialVerifyLink = {
  id: string;
  labelZh: string;
  url: string;
  noteZh?: string;
};

/** Name to copy for CR / IRD self-service (no invented values). */
export function officialVerifyCopyName(report: RiskReport): string {
  const cr = report.official.companiesRegistry;
  if (cr?.matched) {
    const zh = cr.nameZh?.trim();
    if (zh) return zh;
    const en = cr.nameEn?.trim();
    if (en) return en;
  }
  return report.entity.searchLabelUsed.trim();
}

/** Deterministic official links for report UI (no LLM). */
export function buildOfficialVerifyLinks(report: RiskReport): OfficialVerifyLink[] {
  const links: OfficialVerifyLink[] = [
    {
      id: "icris",
      labelZh: OFFICIAL_VERIFY_LINK_LABELS.icris,
      url: ICRIS_HOME_URL,
      noteZh: ICRIS_SELF_SERVICE_NOTE_ZH,
    },
    {
      id: "br-enquiry",
      labelZh: OFFICIAL_VERIFY_LINK_LABELS.brEnquiry,
      url: IRD_BR_ENQUIRY_URL,
      noteZh: BR_ENQUIRY_SELF_SERVICE_NOTE_ZH,
    },
    {
      id: "oro",
      labelZh: OFFICIAL_VERIFY_LINK_LABELS.oro,
      url: ORO_INFO_HOME_URL,
      noteZh: ORO_SELF_SERVICE_NOTE_ZH,
    },
    {
      id: "bd-register",
      labelZh: OFFICIAL_VERIFY_LINK_LABELS.bdRegister,
      url: BD_MWC_REGISTER_SEARCH_URL,
      noteZh: OFFICIAL_VERIFY_LINK_NOTES.bdRegister,
    },
  ];

  const mwcHref =
    report.evaluation.complianceTrack.licenseStatus === "active"
      ? buildBdMwcRegistrySearchUrl({
          companyName:
            report.official.details?.companyName ??
            report.entity.searchLabelUsed,
          registrationNo: report.official.details?.registrationNo,
        })
      : null;

  if (mwcHref) {
    const bd = links.find((l) => l.id === "bd-register");
    if (bd) bd.url = mwcHref;
  }

  return links;
}
