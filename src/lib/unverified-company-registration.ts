import type { RiskReport } from "./report-schema";
import { isReportLegalLookupDegraded } from "./search-cache";

function crLookupOkForC2c(report: RiskReport): boolean {
  const cr = report.official.companiesRegistry;
  return cr?.lookupStatus === "ok";
}

function crNotFoundInActiveList(report: RiskReport): boolean {
  const cr = report.official.companiesRegistry;
  if (!cr || cr.lookupStatus !== "ok") return false;
  return cr.hints.includes("not_found_in_active_list");
}

function crMatched(report: RiskReport): boolean {
  const cr = report.official.companiesRegistry;
  return cr?.lookupStatus === "ok" && cr.matched === true;
}

function crAmbiguous(report: RiskReport): boolean {
  const cr = report.official.companiesRegistry;
  return Boolean(cr?.matchAmbiguous);
}

function baseC2cBlockers(report: RiskReport): boolean {
  if (report.official.mwcMatched) return true;
  if (isReportLegalLookupDegraded(report)) return true;
  if ((report.official.legalEvents ?? []).length > 0) return true;
  const label = report.entity.searchLabelUsed.trim();
  if (report.entity.matchType === "br" && !/\p{L}/u.test(label)) return true;
  const cr = report.official.companiesRegistry;
  if (
    cr &&
    (cr.lookupStatus === "error" ||
      cr.lookupStatus === "timeout" ||
      cr.lookupStatus === "skipped")
  ) {
    return true;
  }
  if (crAmbiguous(report)) return true;
  return false;
}

/** C.2c alert：CR API 400 not_found + MWC miss（Amendment 18 + PR-CR） */
export function shouldShowUnverifiedCompanyRegistrationAlert(
  report: RiskReport,
): boolean {
  if (baseC2cBlockers(report)) return false;
  if (!crLookupOkForC2c(report)) return false;
  if (!crNotFoundInActiveList(report)) return false;
  return true;
}

/** MWC miss + CR 已查到 → note（唔用 alert） */
export function shouldShowMwcMissWithCrFoundNote(
  report: RiskReport,
): boolean {
  if (baseC2cBlockers(report)) return false;
  if (!crMatched(report)) return false;
  return !report.official.mwcMatched;
}

/** @deprecated use shouldShowUnverifiedCompanyRegistrationAlert */
export function shouldShowUnverifiedCompanyRegistrationMode(
  report: RiskReport,
): boolean {
  return shouldShowUnverifiedCompanyRegistrationAlert(report);
}
