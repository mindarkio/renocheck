import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedSearchInput } from "./normalize-search-input";
import {
  foldMwcName,
  isMissingMwcCompanyNameEnColumn,
  MWC_CONTRACTOR_SELECT,
  MWC_CONTRACTOR_SELECT_WITH_EN,
  pickRankedMwcRow,
  type MwcLookupResult,
  type MwcRow,
} from "./mwc-lookup";
import { mwcCompanyNameLookupTerms } from "./mwc-company-search-terms";

function ilikeSubstring(haystack: string, needle: string): boolean {
  const pin = foldMwcName(needle);
  return pin.length > 0 && foldMwcName(haystack).includes(pin);
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
    const withEn = await MwcContractorsMemoryIndex.fetchPages(
      supabase,
      MWC_CONTRACTOR_SELECT_WITH_EN,
    );
    if (withEn.kind === "missing_en") {
      const base = await MwcContractorsMemoryIndex.fetchPages(
        supabase,
        MWC_CONTRACTOR_SELECT,
      );
      if (base.kind !== "ok") MwcContractorsMemoryIndex.throwPageError(base);
      return new MwcContractorsMemoryIndex(base.rows);
    }
    if (withEn.kind !== "ok") MwcContractorsMemoryIndex.throwPageError(withEn);
    return new MwcContractorsMemoryIndex(withEn.rows);
  }

  private static throwPageError(result: {
    kind: "missing_en" | "error";
    error?: { message: string };
  }): never {
    if (result.kind === "error" && result.error) throw result.error;
    throw new Error("mwc_lookup_failed");
  }

  private static async fetchPages(
    supabase: SupabaseClient,
    columns: string,
  ): Promise<
    | { kind: "ok"; rows: MwcRow[] }
    | { kind: "missing_en" }
    | { kind: "error"; error: { message: string } }
  > {
    const pageSize = 1000;
    let from = 0;
    const out: MwcRow[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("mwc_contractors")
        .select(columns)
        .range(from, from + pageSize - 1);
      if (error) {
        if (isMissingMwcCompanyNameEnColumn(error)) return { kind: "missing_en" };
        return { kind: "error", error };
      }
      const batch = (data ?? []) as unknown as MwcRow[];
      out.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    return { kind: "ok", rows: out };
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
        const matches = this.rows.filter(
          (r) =>
            ilikeSubstring(r.company_name, term) ||
            (r.company_name_en
              ? ilikeSubstring(r.company_name_en, term)
              : false),
        );
        if (matches.length === 0) continue;
        if (matches.length >= 2) ambiguous = true;
        return { row: pickRankedMwcRow(matches, term), ambiguous };
      }
      return { row: null, ambiguous: false };
    }

    return { row: null, ambiguous: false };
  }
}
