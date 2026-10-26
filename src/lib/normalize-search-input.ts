import type { SearchInput } from "./report-schema";
import { normalizeHongKongPhone } from "./normalize-phone";

export type NormalizedSearchInput = {
  companyName?: string;
  phone?: string;
  br?: string;
  /**
   * Buildings Department registration number chosen from the picker.
   * Present only for a company-name search. The report then uses that row
   * and is not marked ambiguous (DEC-0015).
   */
  mwcRegistrationNo?: string;
  matchType: "phone" | "br" | "company_name";
};

export function normalizeSearchInput(raw: SearchInput): NormalizedSearchInput {
  const companyName = raw.companyName?.trim() || undefined;
  const br = raw.br?.trim() || undefined;
  const phone = normalizeHongKongPhone(raw.phone) ?? undefined;

  let matchType: NormalizedSearchInput["matchType"] = "company_name";
  if (phone) matchType = "phone";
  else if (br) matchType = "br";

  const mwcRegistrationNo =
    matchType === "company_name"
      ? raw.mwcRegistrationNo?.trim() || undefined
      : undefined;

  return {
    companyName,
    phone,
    br,
    matchType,
    ...(mwcRegistrationNo ? { mwcRegistrationNo } : {}),
  };
}

/** Scripts / D2 in-memory lookup that only search by company label. */
export function companyNameOnlySearchInput(
  companyName: string,
): NormalizedSearchInput {
  return { companyName, matchType: "company_name" };
}
