import type { RiskReport } from "./report-schema";
import { isReportLegalLookupDegraded } from "./search-cache";

/** C.2c：屋宇署 MWC 名冊冇對應＋判詞查詢冇 degraded＋冇判詞紀錄；純 BR 搜尋唔顯示（MWC 名冊唔以 BR 索引）。
 *  bdRegisterMatches／companiesRegistry 未入 schema，會被 zod strip；入 schema 之後先再加。 */
export function shouldShowUnverifiedCompanyRegistrationMode(
  report: RiskReport,
): boolean {
  if (report.official.mwcMatched) return false;
  if (isReportLegalLookupDegraded(report)) return false;
  if ((report.official.legalEvents ?? []).length > 0) return false;
  const label = report.entity.searchLabelUsed.trim();
  if (report.entity.matchType === "br" && !/\p{L}/u.test(label)) return false;
  return true;
}
