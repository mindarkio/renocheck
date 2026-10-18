import { buildBdMwcRegistrySearchUrl } from "./bd-mwc-registry-url";
import type { RiskReport } from "./report-schema";
import {
  BD_BRAVO_BUILDING_RECORDS_URL,
  BD_MWC_REGISTER_SEARCH_URL,
  GOV_HK_BR_ENQUIRY_URL,
  ICRIS_HOME_URL,
  OFFICIAL_VERIFY_LINK_LABELS,
  OFFICIAL_VERIFY_LINK_NOTES,
  ORO_INFO_HOME_URL,
} from "./report-trust-copy-zh";

export type OfficialVerifyLink = {
  id: string;
  labelZh: string;
  url: string;
  noteZh?: string;
};

/** Deterministic official links for report UI (no LLM). */
export function buildOfficialVerifyLinks(report: RiskReport): OfficialVerifyLink[] {
  const links: OfficialVerifyLink[] = [
    {
      id: "icris",
      labelZh: OFFICIAL_VERIFY_LINK_LABELS.icris,
      url: ICRIS_HOME_URL,
    },
    {
      id: "br-enquiry",
      labelZh: OFFICIAL_VERIFY_LINK_LABELS.brEnquiry,
      url: GOV_HK_BR_ENQUIRY_URL,
      noteZh: OFFICIAL_VERIFY_LINK_NOTES.brEnquiry,
    },
    {
      id: "oro",
      labelZh: OFFICIAL_VERIFY_LINK_LABELS.oro,
      url: ORO_INFO_HOME_URL,
    },
    {
      id: "bd-register",
      labelZh: OFFICIAL_VERIFY_LINK_LABELS.bdRegister,
      url: BD_MWC_REGISTER_SEARCH_URL,
      noteZh: OFFICIAL_VERIFY_LINK_NOTES.bdRegister,
    },
    {
      id: "bravo",
      labelZh: OFFICIAL_VERIFY_LINK_LABELS.bravo,
      url: BD_BRAVO_BUILDING_RECORDS_URL,
      noteZh: OFFICIAL_VERIFY_LINK_NOTES.bravo,
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
