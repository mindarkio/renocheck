import { createHash } from "node:crypto";
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

  /** @deprecated D2 用 loadD2GoldenMwcRows；呢個會讀 primary_signatory_name */
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

  /** Snapshot for D2 step-cache invalidation when MWC import changes. */
  snapshotContentHash(): string {
    const payload = this.rows
      .map((r) => `${r.registration_no ?? ""}|${r.company_name}`)
      .sort()
      .join("\n");
    return createHash("sha256").update(payload).digest("hex").slice(0, 16);
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
