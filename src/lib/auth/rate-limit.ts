import "server-only";

import { createHash } from "node:crypto";
import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Live rows. The SQL function also refuses any caller-supplied cap above this. */
export const AUTH_RATE_LIMIT_MAX_ROWS = 5_000;

export type AuthRateLimitResult = "ok" | "limited" | "unavailable";

/**
 * Durable OTP / verify allowance. The bucket stored in Postgres is a hash,
 * not the email or IP. Any database or guard failure fails closed.
 */
export async function takeAuthRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<AuthRateLimitResult> {
  if (!input.key || input.limit <= 0 || input.windowMs <= 0) return "unavailable";
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return "unavailable";
  }
  const admin = getSupabaseAdmin();
  if (!admin) return "unavailable";

  const bucket = createHash("sha256").update(input.key).digest("hex");
  const { data, error } = await admin.rpc("take_auth_rate_limit", {
    p_bucket: bucket,
    p_limit: input.limit,
    p_window_seconds: Math.ceil(input.windowMs / 1000),
    p_max_rows: AUTH_RATE_LIMIT_MAX_ROWS,
  });
  if (error || typeof data !== "boolean") return "unavailable";
  return data ? "ok" : "limited";
}
