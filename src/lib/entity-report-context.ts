import type { NormalizedSearchInput } from "./normalize-search-input";
import type { MwcRow } from "./mwc-lookup";
import { resolveEntitySearchLabel } from "./web-search";
import { z } from "zod";

export const nameAlignmentSchema = z.enum([
  "match",
  "mwc_authoritative",
  "user_only",
  "ambiguous",
]);

export type NameAlignment = z.infer<typeof nameAlignmentSchema>;

export function normalizeCompanyNameForCompare(name: string): string {
  return name
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")");
}

/** Serp/L1 label: MWC registration name when MWC hit, else user input fallback. */
export function resolveAuthoritativeSearchLabel(
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: { mwcCompanyName?: string },
): string {
  const mwc = opts?.mwcCompanyName?.trim();
  if (mwc) return mwc;
  return resolveEntitySearchLabel(input, opts);
}

export function buildQueryEcho(input: NormalizedSearchInput): string {
  const parts: string[] = [];
  if (input.companyName?.trim()) parts.push(input.companyName.trim());
  if (input.phone?.trim()) parts.push(input.phone.trim());
  if (input.br?.trim()) parts.push(input.br.trim());
  return parts.join(" · ") || "—";
}

export function computeNameAlignment(
  input: NormalizedSearchInput,
  mwc: MwcRow | null,
  ambiguous: boolean,
): NameAlignment {
  if (ambiguous) return "ambiguous";
  if (!mwc) {
    return input.companyName?.trim() ? "user_only" : "user_only";
  }
  const userName = input.companyName?.trim();
  if (!userName) return "match";
  const userNorm = normalizeCompanyNameForCompare(userName);
  const mwcNorm = normalizeCompanyNameForCompare(mwc.company_name);
  if (userNorm === mwcNorm) return "match";
  return "mwc_authoritative";
}
