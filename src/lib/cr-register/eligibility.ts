import { isCorporateEntityName } from "../cause-list/party";
import type { NormalizedSearchInput } from "../normalize-search-input";
import type { MwcRow } from "../mwc-lookup";
import { isCrOpenDataBrnEqualValue } from "./brn";

export function shouldRunCompaniesRegistryLookup(
  input: NormalizedSearchInput,
  searchLabelUsed: string,
  mwcRow: MwcRow | null,
): boolean {
  if (input.matchType === "phone") return false;
  const mwcName = mwcRow?.company_name?.trim();
  if (mwcName && isCorporateEntityName(mwcName)) return true;
  if (isCorporateEntityName(searchLabelUsed)) return true;
  if (input.matchType === "br" && input.br && isCrOpenDataBrnEqualValue(input.br)) {
    return true;
  }
  if (input.matchType === "br" && input.companyName) return true;
  if (input.matchType === "company_name" && input.companyName) return true;
  return false;
}

/** Whether we can call CR API with a meaningful query (not tax-BR-only). */
export function hasCrApiQueryPath(
  input: NormalizedSearchInput,
  searchLabelUsed: string,
): boolean {
  if (input.br && isCrOpenDataBrnEqualValue(input.br)) return true;
  if (input.companyName?.trim()) return true;
  if (searchLabelUsed.trim() && /[\u4e00-\u9fffA-Za-z]/u.test(searchLabelUsed)) {
    return true;
  }
  return false;
}
