import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedSearchInput } from "./normalize-search-input";
import { mwcCompanyNameLookupTerms } from "./mwc-company-search-terms";

export type MwcRow = {
  company_name: string;
  phone: string | null;
  registration_no: string;
  expiry_date: string | null;
  primary_signatory_name: string | null;
  source_updated_at: string | null;
};

export type MwcLookupResult = {
  row: MwcRow | null;
  ambiguous: boolean;
};

function throwIfMwcLookupFailed(error: { message: string } | null): void {
  if (error) throw new Error("mwc_lookup_failed", { cause: error });
}

export async function lookupMwcWithMeta(
  supabase: SupabaseClient,
  input: NormalizedSearchInput,
): Promise<MwcLookupResult> {
  if (input.phone) {
    const { data, error } = await supabase
      .from("mwc_contractors")
      .select(
        "company_name, phone, registration_no, expiry_date, primary_signatory_name, source_updated_at",
      )
      .eq("phone", input.phone)
      .limit(1)
      .maybeSingle();
    throwIfMwcLookupFailed(error);
    if (data) return { row: data, ambiguous: false };
  }

  if (input.br) {
    const { data, error } = await supabase
      .from("mwc_contractors")
      .select(
        "company_name, phone, registration_no, expiry_date, primary_signatory_name, source_updated_at",
      )
      .ilike("registration_no", `%${input.br}%`)
      .limit(1)
      .maybeSingle();
    throwIfMwcLookupFailed(error);
    if (data) return { row: data, ambiguous: false };
  }

  if (input.companyName) {
    let ambiguous = false;
    for (const term of mwcCompanyNameLookupTerms(input.companyName)) {
      const { data, error } = await supabase
        .from("mwc_contractors")
        .select(
          "company_name, phone, registration_no, expiry_date, primary_signatory_name, source_updated_at",
        )
        .ilike("company_name", `%${term}%`)
        .limit(2);
      throwIfMwcLookupFailed(error);
      if (!data?.length) continue;
      if (data.length >= 2) ambiguous = true;
      return { row: data[0], ambiguous };
    }
    return { row: null, ambiguous: false };
  }

  return { row: null, ambiguous: false };
}

export async function lookupMwcContractor(
  supabase: SupabaseClient,
  input: NormalizedSearchInput,
): Promise<MwcRow | null> {
  const { row } = await lookupMwcWithMeta(supabase, input);
  return row;
}

export function isIndividualRegistration(registrationNo: string): boolean {
  return registrationNo.toUpperCase().includes("MWC(W)");
}
