import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Removes quote rows first, then the auth user.
 * A failed row delete does not continue to deleteUser.
 */
export async function deleteAccountAndAnalyses(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const claims = await admin
    .from("quote_analysis_claims")
    .delete()
    .eq("user_id", userId);
  if (claims.error) return false;

  const analyses = await admin
    .from("quote_analyses")
    .delete()
    .eq("user_id", userId);
  if (analyses.error) return false;

  const removed = await admin.auth.admin.deleteUser(userId);
  return !removed.error;
}
