import "server-only";

import { createHmac } from "node:crypto";
import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Live rows. The SQL function also refuses any caller-supplied cap above this. */
export const AUTH_RATE_LIMIT_MAX_ROWS = 5_000;

/** Shorter secrets are rejected so the bucket cannot be brute-forced offline. */
export const AUTH_RATE_LIMIT_SECRET_MIN_LENGTH = 32;

export type AuthRateLimitResult = "ok" | "limited" | "unavailable";

function rateLimitSecret(): string | null {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET?.trim() ?? "";
  if (secret.length < AUTH_RATE_LIMIT_SECRET_MIN_LENGTH) return null;
  return secret;
}

/** HMAC-SHA256 hex. The table stores this, never the email or IP. */
export function authRateLimitBucket(key: string, secret: string): string {
  return createHmac("sha256", secret).update(key).digest("hex");
}

/**
 * IP part of a rate-limit key. IPv6 clients usually control a whole /64, so
 * per-address buckets would let one client fill the 5000-row table cheaply.
 * IPv4 and IPv4-mapped IPv6 stay per address. Anything unparsable is kept as is.
 */
export function rateLimitIp(raw: string): string {
  const value = raw.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0] ?? "";
  if (!value.includes(":")) return value;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped) return mapped[1] ?? value;
  const halves = value.split("::");
  if (halves.length > 2) return value;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (halves.length === 2 && fill < 1) return value;
  const groups = [...head, ...Array<string>(fill).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return value;
  return `${groups
    .slice(0, 4)
    .map((g) => g.padStart(4, "0"))
    .join(":")}::/64`;
}

/**
 * Durable OTP / verify allowance. The bucket stored in Postgres is an HMAC
 * of the email or IP under AUTH_RATE_LIMIT_SECRET, not the identifier.
 * A missing secret, any database or guard failure, and a full limiter table
 * all fail closed. Evicting live rows or admitting uncounted requests would let
 * whoever fills the table reset other identities' allowances.
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
  return data ? "ok" : "limited";
}
