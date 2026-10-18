import type { RiskReport } from "./report-schema";
import { isReportLegalLookupDegraded } from "./search-cache";

type BdRegisterMatch = {
  registrationStatus?: string;
};

function hasEffectiveGbcMatch(report: RiskReport): boolean {
  const matches = (
    report.official as { bdRegisterMatches?: BdRegisterMatch[] }
  ).bdRegisterMatches;
  if (!matches?.length) return false;
  return matches.some((m) => m.registrationStatus !== "expired");
}

function companiesRegistryPreventsUnverifiedBanner(
  report: RiskReport,
): boolean {
  const cr = (
    report.official as { companiesRegistry?: { matched?: boolean } }
  ).companiesRegistry;
  if (cr === undefined) return false;
  return cr.matched === true;
}

/** C.2c — MWC/GBC miss + no LRS + legal lookup ok; CR when present must not be matched. */
export function shouldShowUnverifiedCompanyRegistrationMode(
  report: RiskReport,
): boolean {
  if (isReportLegalLookupDegraded(report)) return false;
  if (report.official.mwcMatched) return false;
  if (hasEffectiveGbcMatch(report)) return false;
  if (companiesRegistryPreventsUnverifiedBanner(report)) return false;
  if ((report.official.legalEvents ?? []).length > 0) return false;
  return true;
}
