import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedSearchInput } from "./normalize-search-input";
import type { MwcLookupResult, MwcRow } from "./mwc-lookup";
import { mwcCompanyNameLookupTerms } from "./mwc-company-search-terms";

function ilikeSubstring(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** In-memory MWC name lookup — same semantics as `lookupMwcWithMeta` (company / phone / br). */
export class MwcContractorsMemoryIndex {
  private readonly rows: MwcRow[];
  private readonly metaCache = new Map<string, MwcLookupResult>();

  constructor(rows: MwcRow[]) {
    this.rows = rows;
  }

  static async loadAll(supabase: SupabaseClient): Promise<MwcContractorsMemoryIndex> {
    const pageSize = 1000;
    let from = 0;
    const out: MwcRow[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("mwc_contractors")
        .select(
          "company_name, phone, registration_no, expiry_date, primary_signatory_name, source_updated_at",
        )
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const batch = (data ?? []) as MwcRow[];
      out.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    return new MwcContractorsMemoryIndex(out);
  }

  get size(): number {
    return this.rows.length;
  }

  lookupWithMeta(input: NormalizedSearchInput): MwcLookupResult {
    const key = JSON.stringify(input);
    const hit = this.metaCache.get(key);
    if (hit) return hit;

    const result = this.lookupWithMetaUncached(input);
    this.metaCache.set(key, result);
    return result;
  }

  private lookupWithMetaUncached(input: NormalizedSearchInput): MwcLookupResult {
    if (input.phone) {
      const row = this.rows.find((r) => r.phone === input.phone);
      if (row) return { row, ambiguous: false };
    }

    if (input.br) {
      const br = input.br;
      const row = this.rows.find((r) =>
        r.registration_no?.toLowerCase().includes(br.toLowerCase()),
      );
      if (row) return { row, ambiguous: false };
    }

    if (input.companyName) {
      let ambiguous = false;
      for (const term of mwcCompanyNameLookupTerms(input.companyName)) {
        const matches = this.rows.filter((r) =>
          ilikeSubstring(r.company_name, term),
        );
        if (matches.length === 0) continue;
        if (matches.length >= 2) ambiguous = true;
        return { row: matches[0], ambiguous };
      }
      return { row: null, ambiguous: false };
    }

    return { row: null, ambiguous: false };
  }
}
