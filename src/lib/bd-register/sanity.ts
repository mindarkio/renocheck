import type { BdRegisterEntry } from "./types";
import { mwcCompanyRegNos } from "./parse";

export type BdCsvSanityCounts = {
  entries: number;
  mwcCompanies: number;
};

/** Post-B1 production-scale bounds (full list de-duplicated + corporate MWC only). */
export function assertBdCsvSanity(counts: BdCsvSanityCounts): void {
  if (counts.entries < 10_000 || counts.mwcCompanies < 3_000) {
    throw new Error("BD CSV sanity: too few rows");
  }
}

export function sanityCountsFromEntries(entries: BdRegisterEntry[]): BdCsvSanityCounts {
  return {
    entries: entries.length,
    mwcCompanies: mwcCompanyRegNos(entries).size,
  };
}
