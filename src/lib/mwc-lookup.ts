import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedSearchInput } from "./normalize-search-input";
import { mwcCompanyNameLookupTerms } from "./mwc-company-search-terms";

export type MwcRow = {
  company_name: string;
  phone: string | null;
  registration_no: string;
};

export type MwcLookupResult = {
  row: MwcRow | null;
  ambiguous: boolean;
};

export async function lookupMwcWithMeta(
  supabase: SupabaseClient,
  input: NormalizedSearchInput,
): Promise<MwcLookupResult> {
  if (input.phone) {
    const { data } = await supabase
      .from("mwc_contractors")
      .select("company_name, phone, registration_no")
      .eq("phone", input.phone)
      .limit(1)
      .maybeSingle();
    if (data) return { row: data, ambiguous: false };
  }

  if (input.br) {
    const { data } = await supabase
      .from("mwc_contractors")
      .select("company_name, phone, registration_no")
      .ilike("registration_no", `%${input.br}%`)
      .limit(1)
      .maybeSingle();
    if (data) return { row: data, ambiguous: false };
  }

  if (input.companyName) {
    let ambiguous = false;
    for (const term of mwcCompanyNameLookupTerms(input.companyName)) {
      const { data } = await supabase
        .from("mwc_contractors")
        .select("company_name, phone, registration_no")
        .ilike("company_name", `%${term}%`)
        .limit(2);
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

export function maskIndividualDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "師傅";
  const first = trimmed.charAt(0);
  return `${first}** 師傅`;
}
