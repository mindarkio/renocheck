import "server-only";

import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { normalizeQuoteCompanyName } from "@/lib/quote-analysis/schema";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export function isMissingCompanyNameColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /extracted_company_name|confirmed_company_name/i.test(error.message ?? "")
    && /does not exist|schema cache|Could not find/i.test(error.message ?? "");
}

/**
 * Writes names for the signed-in owner. A missing column (migration not applied)
 * is ignored so analysis and search still work. The name is not logged.
 */
export async function saveQuoteCompanyNames(input: {
  analysisId: string;
  userId: string;
  extracted?: string | null;
  confirmed?: string | null;
}): Promise<"saved" | "skipped"> {
  const patch: Record<string, string | null> = {};
  if ("extracted" in input) {
    patch.extracted_company_name = normalizeQuoteCompanyName(input.extracted ?? null);
  }
  if ("confirmed" in input) {
    patch.confirmed_company_name = normalizeQuoteCompanyName(input.confirmed ?? null);
  }
  if (Object.keys(patch).length === 0) return "skipped";
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return "skipped";
  }
  const admin = getSupabaseAdmin();
  if (!admin) return "skipped";
  const { error } = await admin
    .from("quote_analyses")
    .update(patch)
    .eq("id", input.analysisId)
    .eq("user_id", input.userId);
  if (error) return "skipped";
  return "saved";
}
