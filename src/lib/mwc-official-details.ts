import type { MwcRow } from "@/lib/mwc-lookup";

export type OfficialMwcDetails = {
  companyName: string;
  registrationNo?: string;
  expiryDate?: string;
  authorizedSignatory?: string;
  registryDataAsOf?: string;
};

/** Map MWC DB row → report `official.details` (public register names as published). */
export function buildOfficialMwcDetails(mwc: MwcRow): OfficialMwcDetails {
  const authorizedSignatory = mwc.primary_signatory_name?.trim() || undefined;

  return {
    companyName: mwc.company_name,
    registrationNo: mwc.registration_no,
    ...(mwc.expiry_date ? { expiryDate: mwc.expiry_date } : {}),
    ...(authorizedSignatory ? { authorizedSignatory } : {}),
    ...(mwc.source_updated_at
      ? { registryDataAsOf: mwc.source_updated_at }
      : {}),
  };
}
