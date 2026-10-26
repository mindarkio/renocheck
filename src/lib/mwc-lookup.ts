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
  /** The user chose a registration number that is no longer on the register. */
  pickedMissing?: boolean;
};

function throwIfMwcLookupFailed(error: { message: string } | null): void {
  if (error) throw new Error("mwc_lookup_failed", { cause: error });
}

/** Contains-matches ranked in memory. Leading-wildcard ILIKE cannot ORDER BY length. */
export const MWC_NAME_CANDIDATE_LIMIT = 20;

export function foldMwcName(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function fieldMatchTier(field: string | null | undefined, term: string): number | null {
  const name = field?.trim();
  const needle = term.trim();
  if (!name || !needle) return null;
  const hay = foldMwcName(name);
  const pin = foldMwcName(needle);
  if (!pin || !hay.includes(pin)) return null;
  if (hay === pin) return 0;
  if (hay.startsWith(pin)) return 1;
  return 2;
}

function mwcNameMatchTier(row: MwcRow, term: string): number {
  const tiers = [fieldMatchTier(row.company_name, term), fieldMatchTier(row.company_name_en, term)]
    .filter((tier): tier is number => tier !== null);
  if (tiers.length === 0) return 2;
  return Math.min(...tiers);
}

/** Exact name, then a name starting with the typed text, then shorter Chinese name, then registration number. */
export function rankMwcRows(rows: MwcRow[], term: string): MwcRow[] {
  return [...rows].sort((a, b) => {
    const tier = mwcNameMatchTier(a, term) - mwcNameMatchTier(b, term);
    if (tier !== 0) return tier;
    const length = [...a.company_name].length - [...b.company_name].length;
    if (length !== 0) return length;
    const reg = a.registration_no.localeCompare(b.registration_no);
    if (reg !== 0) return reg;
    return a.company_name.localeCompare(b.company_name);
  });
}

/** Exact match, then prefix match, then shortest company_name. */
export function pickRankedMwcRow(rows: MwcRow[], term: string): MwcRow | null {
  return rankMwcRows(rows, term)[0] ?? null;
}

/** Chinese or English register name equals the typed text (case and full-width folded). */
export function isExactMwcNameMatch(row: MwcRow, term: string): boolean {
  return mwcNameMatchTier(row, term) === 0;
}

function columnsForMwcSelect(): string {
  if (
    mwcCompanyNameEnColumn === "absent" &&
    Date.now() - mwcCompanyNameEnAbsentAt < MWC_EN_COLUMN_REPROBE_MS
  ) {
    return MWC_CONTRACTOR_SELECT;
  }
  return MWC_CONTRACTOR_SELECT_WITH_EN;
}

function markEnColumnAbsent(): void {
  mwcCompanyNameEnColumn = "absent";
  mwcCompanyNameEnAbsentAt = Date.now();
}

async function withMwcColumns<T>(
  run: (columns: string) => Promise<{ data: T; error: MwcQueryError | null }>,
): Promise<{ data: T; error: MwcQueryError | null }> {
  const columns = columnsForMwcSelect();
  const first = await run(columns);
  if (columns !== MWC_CONTRACTOR_SELECT && isMissingMwcCompanyNameEnColumn(first.error)) {
    markEnColumnAbsent();
    return run(MWC_CONTRACTOR_SELECT);
  }
  if (columns === MWC_CONTRACTOR_SELECT_WITH_EN && !first.error) {
    mwcCompanyNameEnColumn = "present";
  }
  return first;
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
  const result = await withMwcColumns(async (columns) => {
    const { data, error } = await supabase
      .from("mwc_contractors")
      .select(columns)
      .ilike(column, pattern)
      .limit(MWC_NAME_CANDIDATE_LIMIT);
    return {
      data: (data as MwcRow[] | null) ?? null,
      error: error as MwcQueryError | null,
    };
  });
  return result;
}

async function matchNameColumn(
  supabase: SupabaseClient,
  column: "company_name" | "company_name_en",
  term: string,
): Promise<{ data: MwcRow[] | null; error: MwcQueryError | null; windowFull: boolean }> {
  const escaped = escapeIlikePattern(term);
  const contains = await ilikeContractors(supabase, column, `%${escaped}%`);
  if (contains.error || !contains.data) {
    return { data: contains.data, error: contains.error, windowFull: false };
  }
  const windowFull = contains.data.length >= MWC_NAME_CANDIDATE_LIMIT;
  const sawExact = contains.data.some((row) => mwcNameMatchTier(row, term) === 0);
  if (!windowFull || sawExact) {
    return { data: contains.data, error: null, windowFull };
  }

  const exact = await ilikeContractors(supabase, column, escaped);
  if (exact.error) return { data: exact.data, error: exact.error, windowFull: true };
  const prefix = await ilikeContractors(supabase, column, `${escaped}%`);
  if (prefix.error) return { data: prefix.data, error: prefix.error, windowFull: true };
  return {
    data: mergeMwcRows(contains.data, mergeMwcRows(exact.data ?? [], prefix.data ?? [])),
    error: null,
    windowFull: true,
  };
}

async function collectNameMatches(
  supabase: SupabaseClient,
  term: string,
): Promise<{ rows: MwcRow[]; windowFull: boolean }> {
  const nameRes = await matchNameColumn(supabase, "company_name", term);
  throwIfMwcLookupFailed(nameRes.error);
  let rows = nameRes.data ?? [];
  let windowFull = nameRes.windowFull;
  if (shouldQueryCompanyNameEn(term)) {
    const enRes = await matchNameColumn(supabase, "company_name_en", term);
    if (isMissingMwcCompanyNameEnColumn(enRes.error)) {
      markEnColumnAbsent();
    } else {
      throwIfMwcLookupFailed(enRes.error);
      mwcCompanyNameEnColumn = "present";
      rows = mergeMwcRows(rows, enRes.data ?? []);
      windowFull = windowFull || enRes.windowFull;
    }
  }
  return { rows, windowFull };
}

async function findMwcByRegistrationNo(
  supabase: SupabaseClient,
  registrationNo: string,
): Promise<{ data: MwcRow | null; error: MwcQueryError | null }> {
  return withMwcColumns(async (columns) => {
    const res = await supabase
      .from("mwc_contractors")
      .select(columns)
      .eq("registration_no", registrationNo)
      .limit(1)
      .maybeSingle();
    return {
      data: (res.data as MwcRow | null) ?? null,
      error: res.error as MwcQueryError | null,
    };
  });
}

export type MwcCandidateList = {
  rows: MwcRow[];
  windowFull: boolean;
  /** The typed company name, used for the exact-row tag. */
  typed: string;
};

/** Ranked contains-matches for the picker. Does not pick a row or run a report. */
export async function listMwcCompanyCandidates(
  supabase: SupabaseClient,
  companyName: string,
): Promise<MwcCandidateList> {
  const typed = companyName.trim();
  for (const term of mwcCompanyNameLookupTerms(typed)) {
    const { rows, windowFull } = await collectNameMatches(supabase, term);
    if (rows.length === 0 && !windowFull) continue;
    return { rows: rankMwcRows(rows, term), windowFull, typed };
  }
  return { rows: [], windowFull: false, typed };
}

export async function lookupMwcWithMeta(
  supabase: SupabaseClient,
  input: NormalizedSearchInput,
): Promise<MwcLookupResult> {
  if (input.phone) {
    const phone = input.phone;
    const { data, error } = await withMwcColumns(async (columns) => {
      const res = await supabase
        .from("mwc_contractors")
        .select(columns)
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      return {
        data: (res.data as MwcRow | null) ?? null,
        error: res.error as MwcQueryError | null,
      };
    });
    throwIfMwcLookupFailed(error);
    if (data) return { row: data, ambiguous: false };
  }

  if (input.br) {
    const br = input.br;
    const { data, error } = await withMwcColumns(async (columns) => {
      const res = await supabase
        .from("mwc_contractors")
        .select(columns)
        .ilike("registration_no", `%${escapeIlikePattern(br)}%`)
        .limit(1)
        .maybeSingle();
      return {
        data: (res.data as MwcRow | null) ?? null,
        error: res.error as MwcQueryError | null,
      };
    });
    throwIfMwcLookupFailed(error);
    if (data) return { row: data, ambiguous: false };
  }

  if (input.companyName) {
    if (input.mwcRegistrationNo) {
      const picked = await findMwcByRegistrationNo(supabase, input.mwcRegistrationNo);
      throwIfMwcLookupFailed(picked.error);
      if (!picked.data) return { row: null, ambiguous: false, pickedMissing: true };
      return { row: picked.data, ambiguous: false };
    }
    for (const term of mwcCompanyNameLookupTerms(input.companyName)) {
      const { rows } = await collectNameMatches(supabase, term);
      if (rows.length === 0) continue;
      return {
        row: pickRankedMwcRow(rows, term) ?? rows[0] ?? null,
        ambiguous: rows.length >= 2,
      };
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
