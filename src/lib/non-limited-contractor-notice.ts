import { isCorporateEntityName } from "./cause-list/party";
import type { RiskReport } from "./report-schema";

export function shouldShowNonLimitedContractorNotice(
  report: RiskReport,
): boolean {
  return !isCorporateEntityName(report.entity.searchLabelUsed.trim());
}
