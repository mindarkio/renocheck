/** D2 v3 — auto-import vs review-only case prefixes (Aaron 2026-10-16). */

import { caseRefPrefix } from "./judgment-d2-parties";
import { APPEAL_ENGINEERING_KEEP_PREFIXES } from "./judgment-d2-appeal-prefixes";

/** Auto `import:judgments` — contract / debt civil only. */
export const AUTO_IMPORT_CASE_PREFIXES = new Set([
  "DCCJ",
  "HCA",
  "LDBM",
  "LDPD",
]);

/** Appeals / regulatory — v3e: CACV/HCSA 工程被告可 keep；其餘多為 drop（見 v3e gates）。 */
export const REVIEW_ONLY_CASE_PREFIXES = new Set([
  "CACC",
  "HCMP",
  "HCCT",
  "HKCFI",
  "FCMC",
  "FAMC",
]);

const CONTRACT_DEBT_HINT_RE =
  /裝修|工程|承建|翻新|滲水|室內|水電|裝飾|欠款|工程款|合約|按金|違約|索償|contract|decoration|engineering|renovation|debt|arrears/i;

/** DCCJ / HCA / LDBM / 獨資商號 — 裝修或工程字眼（v3e 清單）。 */
const RENOVATION_ENGINEERING_RE =
  /裝修|裝飾|設計|工程|廚櫃|防水|冷氣|水電|承建|翻新|滲水|室內|裝璜|木工|油漆|泥水|鋁窗|消防|decoration|engineering|interior|design|construction|contracting|waterproof|renovation|contractor|fitting|interiors/i;

const STRICT_RENO_PREFIXES = new Set(["DCCJ", "HCA"]);

export function casePrefix(caseRef: string): string {
  return caseRefPrefix(caseRef);
}

export function suggestsContractOrDebtCase(
  partiesLine: string,
  profileId?: string,
  renovationRelevantSuggested?: boolean,
): boolean {
  if (renovationRelevantSuggested) return true;
  if (CONTRACT_DEBT_HINT_RE.test(partiesLine)) return true;
  if (profileId && CONTRACT_DEBT_HINT_RE.test(profileId)) return true;
  const pid = profileId ?? "";
  if (
    pid.includes("裝修") ||
    pid.includes("工程") ||
    pid.includes("dccj") ||
    pid.includes("hca") ||
    pid.includes("ldpd") ||
    pid.includes("ldbm")
  ) {
    return true;
  }
  return false;
}

/** 被告商號含工程／裝修相關字眼 — 優先視為有信號（Aaron 2026-10-16 v3b）。 */
export function defendantHasEngineeringKeyword(defendantLabel: string): boolean {
  const t = defendantLabel.trim();
  if (t.length < 2) return false;
  return RENOVATION_ENGINEERING_RE.test(t);
}

/** Strict for DCCJ/HCA/LDBM — 唔用寬鬆 `renovationRelevantSuggested` 捷徑。 */
export function hasRenovationEngineeringSignal(input: {
  partiesLine: string;
  profileId?: string;
  defendantLabel: string;
}): boolean {
  if (RENOVATION_ENGINEERING_RE.test(input.partiesLine)) return true;
  if (defendantHasEngineeringKeyword(input.defendantLabel)) return true;
  return false;
}

export type AutoImportEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

export function autoImportEligibility(input: {
  caseRef: string;
  partiesLine: string;
  profileId?: string;
  renovationRelevantSuggested: boolean;
  defendantLabel: string;
}): AutoImportEligibility {
  const prefix = casePrefix(input.caseRef);

  if (APPEAL_ENGINEERING_KEEP_PREFIXES.has(prefix)) {
    if (defendantHasEngineeringKeyword(input.defendantLabel)) {
      return { eligible: true };
    }
    return { eligible: false, reason: "weak_renovation_engineering_signal" };
  }

  if (REVIEW_ONLY_CASE_PREFIXES.has(prefix)) {
    return { eligible: false, reason: "case_prefix_review_only" };
  }

  if (!AUTO_IMPORT_CASE_PREFIXES.has(prefix)) {
    return { eligible: false, reason: "case_prefix_not_auto_import" };
  }

  if (prefix === "LDBM") {
    if (!defendantHasEngineeringKeyword(input.defendantLabel)) {
      return { eligible: false, reason: "ldbm_defendant_name_no_engineering" };
    }
    return { eligible: true };
  }

  if (STRICT_RENO_PREFIXES.has(prefix)) {
    if (
      !hasRenovationEngineeringSignal({
        partiesLine: input.partiesLine,
        profileId: input.profileId,
        defendantLabel: input.defendantLabel,
      })
    ) {
      return { eligible: false, reason: "weak_renovation_engineering_signal" };
    }
    return { eligible: true };
  }

  if (
    !suggestsContractOrDebtCase(
      input.partiesLine,
      input.profileId,
      input.renovationRelevantSuggested,
    )
  ) {
    return { eligible: false, reason: "weak_contract_debt_signal" };
  }

  return { eligible: true };
}

export function isReviewOnlyCaseRef(caseRef: string): boolean {
  const prefix = casePrefix(caseRef);
  if (REVIEW_ONLY_CASE_PREFIXES.has(prefix)) return true;
  return !AUTO_IMPORT_CASE_PREFIXES.has(prefix);
}

