import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decideRegisterCandidateGate,
  toPublicMwcCandidate,
  type PublicMwcCandidate,
} from "./register-candidate-gate";
import { listMwcCompanyCandidates } from "./mwc-lookup";

export type RegisterPreviewBody = {
  matchCount: number;
  windowFull: boolean;
  candidates: PublicMwcCandidate[];
};

/**
 * `POST /api/search` with `{ preview: "register", companyName }` lists
 * Buildings Department rows before a report. Returns the company name only
 * when the body is that preview; otherwise null. `"invalid"` when preview
 * was sent without a company name.
 */
export function readRegisterPreviewCompanyName(body: unknown): string | null | "invalid" {
  if (typeof body !== "object" || body === null) return null;
  const preview = (body as { preview?: unknown }).preview;
  if (preview == null) return null;
  if (preview !== "register") return "invalid";
  const companyName = (body as { companyName?: unknown }).companyName;
  if (typeof companyName !== "string" || !companyName.trim()) return "invalid";
  return companyName.trim();
}

export async function buildRegisterPreview(
  supabase: SupabaseClient,
  companyName: string,
): Promise<RegisterPreviewBody> {
  const listed = await listMwcCompanyCandidates(supabase, companyName);
  const gate = decideRegisterCandidateGate({
    matchCount: listed.rows.length,
    windowFull: listed.windowFull,
  });
  return {
    matchCount: listed.rows.length,
    windowFull: listed.windowFull,
    candidates:
      gate === "picker"
        ? listed.rows.map((row) => toPublicMwcCandidate(row, listed.typed))
        : [],
  };
}
