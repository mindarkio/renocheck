import "server-only";

import { createHmac } from "node:crypto";
import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Live rows. The SQL function also refuses any caller-supplied cap above this. */
export const AUTH_RATE_LIMIT_MAX_ROWS = 5_000;

/** Shorter secrets are rejected so the bucket cannot be brute-forced offline. */
export const AUTH_RATE_LIMIT_SECRET_MIN_LENGTH = 32;

const RATE_LIMIT_TABLE = "auth_otp_rate_limits";

export type AuthRateLimitResult = "ok" | "limited" | "unavailable";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

function rateLimitSecret(): string | null {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET?.trim() ?? "";
  if (secret.length < AUTH_RATE_LIMIT_SECRET_MIN_LENGTH) return null;
  return secret;
}

/** HMAC-SHA256 hex. The table stores this, never the email or IP. */
export function authRateLimitBucket(key: string, secret: string): string {
  return createHmac("sha256", secret).update(key).digest("hex");
}

function finiteHitCount(data: unknown): number | null | undefined {
  if (data == null) return null;
  if (typeof data !== "object" || !("hit_count" in data)) return undefined;
  const raw = (data as { hit_count?: unknown }).hit_count;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return undefined;
}

async function readHitCount(
  admin: Admin,
  bucket: string,
): Promise<{ ok: true; hits: number | null } | { ok: false }> {
  const { data, error } = await admin
    .from(RATE_LIMIT_TABLE)
    .select("hit_count")
    .eq("bucket", bucket)
    .maybeSingle();
  if (error) return { ok: false };
  const hits = finiteHitCount(data);
  if (hits === undefined) return { ok: false };
  return { ok: true, hits };
}

/**
 * Drop the soonest-expiring other row so a full table can admit this bucket.
 * Returns false when nothing was removed. Never deletes this identity's row.
 */
async function evictSoonestOtherBucket(admin: Admin, bucket: string): Promise<boolean> {
  const oldest = await admin
    .from(RATE_LIMIT_TABLE)
    .select("bucket")
    .order("reset_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (oldest.error) return false;
  const victim =
    oldest.data && typeof oldest.data === "object" && "bucket" in oldest.data
      ? oldest.data.bucket
      : null;
  if (typeof victim !== "string" || !/^[0-9a-f]{64}$/.test(victim) || victim === bucket) {
    return false;
  }
  const removed = await admin.from(RATE_LIMIT_TABLE).delete().eq("bucket", victim);
  return !removed.error;
}

/**
 * `false` from take_auth_rate_limit means either this bucket is over its
 * allowance, or the table is at its cap and the insert was refused.
 * Only the first case is a real limit. A full table must not lock out every
 * new identity: free one soon-to-expire slot and retry once, then allow.
 */
async function resolveRefusal(
  admin: Admin,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<AuthRateLimitResult> {
  const row = await readHitCount(admin, bucket);
  if (!row.ok) return "unavailable";
  if (row.hits !== null && row.hits >= limit) return "limited";
  if (row.hits !== null) return "ok";

  const freed = await evictSoonestOtherBucket(admin, bucket);
  if (!freed) return "ok";

  const retry = await admin.rpc("take_auth_rate_limit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_max_rows: AUTH_RATE_LIMIT_MAX_ROWS,
  });
  if (retry.error || typeof retry.data !== "boolean") return "unavailable";
  if (retry.data) return "ok";

  const again = await readHitCount(admin, bucket);
  if (!again.ok) return "unavailable";
  if (again.hits !== null && again.hits >= limit) return "limited";
  return "ok";
}

/**
 * Durable OTP / verify allowance. The bucket stored in Postgres is an HMAC
 * of the email or IP under AUTH_RATE_LIMIT_SECRET, not the identifier.
 * A missing secret, or any database or guard failure, fails closed.
 * A full limiter table does not: identities that are not already over their
 * own allowance are admitted instead of locking everyone out.
 */
export async function takeAuthRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<AuthRateLimitResult> {
  if (!input.key || input.limit <= 0 || input.windowMs <= 0) return "unavailable";
  const secret = rateLimitSecret();
  if (!secret) return "unavailable";
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return "unavailable";
  }
  const admin = getSupabaseAdmin();
  if (!admin) return "unavailable";

  const bucket = authRateLimitBucket(input.key, secret);
  const windowSeconds = Math.ceil(input.windowMs / 1000);
  const { data, error } = await admin.rpc("take_auth_rate_limit", {
    p_bucket: bucket,
    p_limit: input.limit,
    p_window_seconds: windowSeconds,
    p_max_rows: AUTH_RATE_LIMIT_MAX_ROWS,
  });
  if (error || typeof data !== "boolean") return "unavailable";
  if (data) return "ok";
  return resolveRefusal(admin, bucket, input.limit, windowSeconds);
}
