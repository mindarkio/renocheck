import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedSearchInput } from "./normalize-search-input";
import {
  escapeIlikePattern,
  mwcCompanyNameLookupTerms,
} from "./mwc-company-search-terms";

export const MWC_CONTRACTOR_SELECT =
  "company_name, phone, registration_no, expiry_date, primary_signatory_name, source_updated_at";

export const MWC_CONTRACTOR_SELECT_WITH_EN =
  "company_name, company_name_en, phone, registration_no, expiry_date, primary_signatory_name, source_updated_at";

export type MwcRow = {
  company_name: string;
  /** Present after the company_name_en migration. Lookup still works without it. */
  company_name_en?: string | null;
  phone: string | null;
  registration_no: string;
  expiry_date: string | null;
  primary_signatory_name: string | null;
  source_updated_at: string | null;
};

type MwcQueryError = { message: string; code?: string; details?: string };

let mwcCompanyNameEnColumn: "unknown" | "present" | "absent" = "unknown";
let mwcCompanyNameEnAbsentAt = 0;

/** After the migration lands, warm instances re-probe instead of skipping until a cold start. */
export const MWC_EN_COLUMN_REPROBE_MS = 10 * 60 * 1000;

/** Test hook. Production learns the column from the first lookup error or success. */
export function resetMwcCompanyNameEnColumnProbeForTests(): void {
  mwcCompanyNameEnColumn = "unknown";
  mwcCompanyNameEnAbsentAt = 0;
}

function shouldQueryCompanyNameEn(term: string): boolean {
  // company_name_en holds the register's English names only.
  if (/\p{Script=Han}/u.test(term)) return false;
  if (mwcCompanyNameEnColumn !== "absent") return true;
  return Date.now() - mwcCompanyNameEnAbsentAt >= MWC_EN_COLUMN_REPROBE_MS;
}

export function isMissingMwcCompanyNameEnColumn(
  error: { message?: string; code?: string; details?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const blob = `${error.message ?? ""} ${error.details ?? ""}`;
  if (!/company_name_en/i.test(blob)) return false;
  const code = error.code ?? "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist|schema cache|could not find/i.test(blob)
  );
}

export type MwcLookupResult = {
  row: MwcRow | null;
  ambiguous: boolean;
};

function throwIfMwcLookupFailed(error: { message: string } | null): void {
  if (error) throw new Error("mwc_lookup_failed", { cause: error });
}

function mergeMwcRows(primary: MwcRow[], extra: MwcRow[]): MwcRow[] {
  const out: MwcRow[] = [];
  const seen = new Set<string>();
  for (const row of [...primary, ...extra]) {
    const key = row.registration_no || row.company_name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function ilikeContractors(
  supabase: SupabaseClient,
  column: "company_name" | "company_name_en",
  pattern: string,
): Promise<{ data: MwcRow[] | null; error: MwcQueryError | null }> {
  const { data, error } = await supabase
    .from("mwc_contractors")
    .select(MWC_CONTRACTOR_SELECT)
    .ilike(column, pattern)
    .limit(2);
  return {
    data: (data as MwcRow[] | null) ?? null,
    error: error as MwcQueryError | null,
  };
}

export async function lookupMwcWithMeta(
  supabase: SupabaseClient,
  input: NormalizedSearchInput,
): Promise<MwcLookupResult> {
  if (input.phone) {
    const { data, error } = await supabase
      .from("mwc_contractors")
      .select(MWC_CONTRACTOR_SELECT)
      .eq("phone", input.phone)
      .limit(1)
      .maybeSingle();
    throwIfMwcLookupFailed(error);
    if (data) return { row: data, ambiguous: false };
  }

  if (input.br) {
    const { data, error } = await supabase
      .from("mwc_contractors")
      .select(MWC_CONTRACTOR_SELECT)
      .ilike("registration_no", `%${escapeIlikePattern(input.br)}%`)
      .limit(1)
      .maybeSingle();
    throwIfMwcLookupFailed(error);
    if (data) return { row: data, ambiguous: false };
  }

  if (input.companyName) {
    for (const term of mwcCompanyNameLookupTerms(input.companyName)) {
      const pattern = `%${escapeIlikePattern(term)}%`;
      const nameRes = await ilikeContractors(supabase, "company_name", pattern);
      throwIfMwcLookupFailed(nameRes.error);
      let rows = nameRes.data ?? [];
      if (rows.length < 2 && shouldQueryCompanyNameEn(term)) {
        const enRes = await ilikeContractors(
          supabase,
          "company_name_en",
          pattern,
        );
        if (isMissingMwcCompanyNameEnColumn(enRes.error)) {
          mwcCompanyNameEnColumn = "absent";
          mwcCompanyNameEnAbsentAt = Date.now();
        } else {
          throwIfMwcLookupFailed(enRes.error);
          mwcCompanyNameEnColumn = "present";
          rows = mergeMwcRows(rows, enRes.data ?? []);
        }
      }
      if (rows.length === 0) continue;
      return { row: rows[0] ?? null, ambiguous: rows.length >= 2 };
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
