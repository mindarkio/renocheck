import { caseRefPrefix } from "./judgment-d2-parties";

/**
 * LDBM：申請人為業主立案法團、被告非裝修／工程承建商（含業主／投資／物業方）→ drop。
 * 被告商號含工程字眼則仍可 keep（例：LDBM 6/1998 成龍工程有限公司）。
 */
export function ldbmOcApplicantNonContractorDropReason(input: {
  caseRef: string;
  plaintiffLabel: string;
  defendantLabel: string;
}): string | null {
  if (caseRefPrefix(input.caseRef) !== "LDBM") return null;
  if (!plaintiffIsOwnersCorporation(input.plaintiffLabel)) return null;
  if (defendantHasEngineeringKeyword(input.defendantLabel)) return null;
  return "ldbm_oc_applicant_defendant_not_contractor";
}
import { defendantHasEngineeringKeyword } from "./judgment-d2-case-policy";
import type { DefendantEntityKind } from "./judgment-d2-entity";

const VEHICLE_RE =
  /車之城|汽車|車輛|車行|電單車|motor\s*vehicle|car\s*city/i;

const ESTATE_AGENT_RE =
  /地產代理|家居地產|物業代理|置業代理|estate\s*agent|property\s*agency|地產\s*\(/i;

const PROPERTY_MGMT_RE = /物業管理|property\s*management/i;

const TENANCY_TITLE_RE =
  /業權|租賃|租務|租約|landlord|tenant|tenancy|title\s*to\s*land|incapacitated\s*person/i;

const WORK_INJURY_RE =
  /僱主|工傷|employees?\s*compensation|personal\s*injuries|工傷/i;

/** 非裝修承建被告行業／案類 — deterministic drop reason or null。 */
export function plaintiffIsOwnersCorporation(plaintiffLabel: string): boolean {
  return /INCORPORATED OWNERS|業主立案法團|owners\s*corporation/i.test(
    plaintiffLabel.trim(),
  );
}

export function defendantRenovationScopeDropReason(input: {
  caseRef: string;
  defendantLabel: string;
  plaintiffLabel: string;
  partiesLine: string;
  entityKind: DefendantEntityKind;
}): string | null {
  const defendant = input.defendantLabel.trim();
  const plaintiff = input.plaintiffLabel.trim();
  const parties = input.partiesLine.trim();
  const blob = `${defendant} ${parties}`;

  if (VEHICLE_RE.test(defendant)) {
    return "defendant_vehicle_industry";
  }
  if (ESTATE_AGENT_RE.test(defendant)) {
    return "defendant_estate_agent";
  }
  if (PROPERTY_MGMT_RE.test(defendant)) {
    return "defendant_property_management";
  }
  if (TENANCY_TITLE_RE.test(blob)) {
    return "defendant_tenancy_or_title";
  }
  if (WORK_INJURY_RE.test(defendant) || WORK_INJURY_RE.test(parties)) {
    return "defendant_work_injury_context";
  }

  const prefix = caseRefPrefix(input.caseRef);
  const renovationContractNarrative =
    /裝修|合約|工程款|裝修工程|renovation|decoration/i.test(parties);
  const personalPlaintiff =
    /^[A-Z][A-Z\s.'-]{3,60}$/i.test(plaintiff) &&
    !/\b(LTD|LIMITED|COMPANY|INC|CORP|OWNERS)\b/i.test(plaintiff);
  if (
    prefix === "CACV" &&
    personalPlaintiff &&
    !renovationContractNarrative &&
    defendantHasEngineeringKeyword(defendant)
  ) {
    return "defendant_work_injury_context";
  }

  if (input.entityKind === "company") {
    const ocVsContractor =
      plaintiffIsOwnersCorporation(plaintiff) &&
      /\b(CO\.?|COMPANY|LTD|LIMITED|有限公司)\b/i.test(defendant);
    if (
      !defendantHasEngineeringKeyword(defendant) &&
      !ocVsContractor
    ) {
      return "defendant_not_engineering_trade";
    }
  }

  return null;
}
