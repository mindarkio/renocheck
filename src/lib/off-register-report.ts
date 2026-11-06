import type { RiskReport } from "./report-schema";
import {
  CR_STATUS_CHIP_CANDIDATES_ZH,
  CR_STATUS_CHIP_MATCHED_ZH,
  CR_STATUS_CHIP_NOT_FOUND_ZH,
  CR_STATUS_CHIP_UNAVAILABLE_ZH,
  CR_STATUS_CHIP_UNCONFIRMED_ZH,
  MWC_MISS_FALLBACK_CR_INCONCLUSIVE_ZH,
  MWC_MISS_NOTE_CR_SIMILAR_ZH,
  OFF_REGISTER_CR_AMBIGUOUS_LEAD_ZH,
  OFF_REGISTER_CR_CANDIDATES_LEAD_ZH,
  OFF_REGISTER_CR_MATCHED_LEAD_ZH,
  OFF_REGISTER_CR_NOT_FOUND_LEAD_ZH,
  OFF_REGISTER_CR_NOT_RUN_LEAD_ZH,
  OFF_REGISTER_CR_UNAVAILABLE_LEAD_ZH,
} from "./report-trust-copy-zh";

/**
 * Company-name search that did not attach an MWC register row.
 * Phone and BR reports keep the older notes. Matching rules are unchanged.
 */
export function shouldShowOffRegisterState(report: RiskReport): boolean {
  return (
    report.entity.matchType === "company_name" && !report.official.mwcMatched
  );
}

export type OffRegisterCrKind =
  | "matched"
  | "candidates"
  | "not_found"
  | "ambiguous"
  | "inconclusive"
  | "unavailable"
  | "not_run";

/** What this run can honestly say about Companies Registry. */
export function offRegisterCrKind(report: RiskReport): OffRegisterCrKind {
  const cr = report.official.companiesRegistry;
  if (!cr || cr.lookupStatus === "skipped") return "not_run";
  if (cr.lookupStatus === "error" || cr.lookupStatus === "timeout") {
    return "unavailable";
  }
  if (cr.matchAmbiguous) return "ambiguous";
  if (cr.matched === true) return "matched";
  if ((cr.candidateNames?.length ?? 0) > 0) return "candidates";
  if (cr.hints.includes("not_found_in_active_list")) return "not_found";
  return "inconclusive";
}

export function offRegisterCrLeadZh(report: RiskReport): string {
  const kind = offRegisterCrKind(report);
  if (
    kind === "matched" &&
    report.official.companiesRegistry?.matchTier === "C"
  ) {
    return MWC_MISS_NOTE_CR_SIMILAR_ZH;
  }
  switch (kind) {
    case "matched":
      return OFF_REGISTER_CR_MATCHED_LEAD_ZH;
    case "candidates":
      return OFF_REGISTER_CR_CANDIDATES_LEAD_ZH;
    case "not_found":
      return OFF_REGISTER_CR_NOT_FOUND_LEAD_ZH;
    case "ambiguous":
      return OFF_REGISTER_CR_AMBIGUOUS_LEAD_ZH;
    case "inconclusive":
      return MWC_MISS_FALLBACK_CR_INCONCLUSIVE_ZH;
    case "unavailable":
      return OFF_REGISTER_CR_UNAVAILABLE_LEAD_ZH;
    case "not_run":
      return OFF_REGISTER_CR_NOT_RUN_LEAD_ZH;
  }
}

/**
 * Hero chip for CR, only when it changes what the reader should believe.
 * A successful CR match on an MWC-hit report stays in the identity card.
 */
export function crStatusChipLabel(report: RiskReport): string | null {
  const kind = offRegisterCrKind(report);
  if (kind === "unavailable") return CR_STATUS_CHIP_UNAVAILABLE_ZH;
  if (!shouldShowOffRegisterState(report)) return null;
  switch (kind) {
    case "matched":
      return CR_STATUS_CHIP_MATCHED_ZH;
    case "candidates":
      return CR_STATUS_CHIP_CANDIDATES_ZH;
    case "not_found":
      return CR_STATUS_CHIP_NOT_FOUND_ZH;
    case "ambiguous":
    case "inconclusive":
      return CR_STATUS_CHIP_UNCONFIRMED_ZH;
    case "unavailable":
    case "not_run":
      return null;
  }
}

/** CR rows worth reading next to the off-register explanation. */
export function shouldEmphasizeCompaniesRegistry(report: RiskReport): boolean {
  if (!shouldShowOffRegisterState(report)) return false;
  const kind = offRegisterCrKind(report);
  return kind === "matched" || kind === "candidates" || kind === "ambiguous";
}
