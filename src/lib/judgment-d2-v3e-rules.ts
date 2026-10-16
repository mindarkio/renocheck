/** D2 v3e — review 收窄、獨資 keep/drop、法院前綴 drop（Aaron 2026-10-16）。 */

import { defendantHasEngineeringKeyword } from "./judgment-d2-case-policy";
import { caseRefPrefix } from "./judgment-d2-parties";
import { extractSoleProprietorTradeAlias } from "./judgment-d2-v3d-rules";

/** 原 review-only 前綴 → v3e 直接 drop。 */
export const V3E_AUTO_DROP_PREFIXES = new Set([
  "DCPI",
  "HCPI",
  "DCMP",
  "LDPE",
  "LDCS",
  "LDNT",
  "FACV",
  "HCB",
]);

export const SOLE_PROP_AUTO_KEEP_PREFIXES = new Set(["DCCJ", "HCA", "HCSA"]);

/** 與 CACV 相同：被告公司名有工程字眼可 keep。 */
export const APPEAL_ENGINEERING_KEEP_PREFIXES = new Set(["CACV", "HCSA"]);

export function isV3eAutoDropCasePrefix(caseRef: string): boolean {
  return V3E_AUTO_DROP_PREFIXES.has(caseRefPrefix(caseRef));
}

export function isSolePropAutoKeepCourt(caseRef: string): boolean {
  return SOLE_PROP_AUTO_KEEP_PREFIXES.has(caseRefPrefix(caseRef));
}

export function isAppealEngineeringKeepPrefix(caseRef: string): boolean {
  return APPEAL_ENGINEERING_KEEP_PREFIXES.has(caseRefPrefix(caseRef));
}

export function soleProprietorTradeHasKeepKeyword(defendantLabel: string): boolean {
  const trade = extractSoleProprietorTradeAlias(defendantLabel);
  const probe = trade ?? defendantLabel;
  return defendantHasEngineeringKeyword(probe);
}

const HOUSING_AUTHORITY_RE =
  /房委會|房屋委員會|housing\s+authority|housing\s+department/i;

export function isDefendantHousingAuthority(defendantLabel: string): boolean {
  return HOUSING_AUTHORITY_RE.test(defendantLabel.trim());
}

/** Map auto-import ineligible reasons to v3e drop reason labels. */
export function normalizeV3eDropReason(reason: string): string {
  if (reason === "weak_renovation_engineering_signal") {
    return "weak_renovation_signal";
  }
  if (reason === "case_prefix_review_only") {
    return "weak_renovation_signal";
  }
  return reason;
}
