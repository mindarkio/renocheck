import { isIndividualRegistration } from "@/lib/mwc-lookup";

/** 屋宇署「搜尋註冊專業人士或承建商」（繁中）；會經免責頁再進入搜尋。 */
export const BD_REGISTRATION_SEARCH_URL =
  "https://www.bd.gov.hk/tc/resources/online-tools/registers-search/registrationsearch.html";

export type MwcRegistryLinkInput = {
  companyName?: string;
  registrationNo?: string;
};

/** Prefill BD register search for MWC / MWC(W) rows from our MWC import. */
export function buildBdMwcRegistrySearchUrl(
  input: MwcRegistryLinkInput,
): string | null {
  const registrationNo = input.registrationNo?.trim();
  const companyName = input.companyName?.trim();

  if (!registrationNo && !companyName) return null;

  const params = new URLSearchParams();
  if (companyName) params.set("name", companyName);
  if (registrationNo) params.set("txt_reg_no", registrationNo);

  const regType = registrationNo && isIndividualRegistration(registrationNo)
    ? "MWC(W)"
    : "MWC";
  params.set("txt_reg_type", regType);

  return `${BD_REGISTRATION_SEARCH_URL}?${params.toString()}`;
}
