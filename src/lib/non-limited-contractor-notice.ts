import { isCorporateEntityName } from "./cause-list/party";
import type { RiskReport } from "./report-schema";

export function shouldShowNonLimitedContractorNotice(
  report: RiskReport,
): boolean {
  const name = (
    report.official.details?.companyName ?? report.entity.searchLabelUsed
  ).trim();
  if (!/\p{L}/u.test(name)) return false;
  return !isCorporateEntityName(name);
}
