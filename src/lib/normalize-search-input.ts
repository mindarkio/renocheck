import type { SearchInput } from "./report-schema";
import { normalizeHongKongPhone } from "./normalize-phone";

export type NormalizedSearchInput = {
  companyName?: string;
  phone?: string;
  br?: string;
  matchType: "phone" | "br" | "company_name";
};

export function normalizeSearchInput(raw: SearchInput): NormalizedSearchInput {
  const companyName = raw.companyName?.trim() || undefined;
  const br = raw.br?.trim() || undefined;
  const phone = normalizeHongKongPhone(raw.phone) ?? undefined;

  let matchType: NormalizedSearchInput["matchType"] = "company_name";
  if (phone) matchType = "phone";
  else if (br) matchType = "br";

  return { companyName, phone, br, matchType };
}

/** Scripts / D2 in-memory lookup that only search by company label. */
export function companyNameOnlySearchInput(
  companyName: string,
): NormalizedSearchInput {
  return { companyName, matchType: "company_name" };
}
