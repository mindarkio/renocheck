import "server-only";

/**
 * Fail-closed auth diagnostics. Vercel keeps console.warn / console.error.
 * Never include emails, IPs, rate-limit keys, HMAC buckets, secrets, or tokens.
 */

const MAX_LOG_TEXT = 240;

const URL_TEXT = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const SB_KEY = /\bsb_[A-Za-z0-9_-]+/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
/**
 * Any token with an @. normalizeLoginEmail accepts any non-space local part and
 * non-ASCII domains, and GoTrue can echo the address back in its message.
 */
const EMAIL = /\S*@\S*/g;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const IPV6 = /\b[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7}\b/gi;
const HEX_BUCKET = /\b[0-9a-f]{32,}\b/gi;
const BEARER = /bearer\s+\S+/gi;

export type AuthRateLimitUnavailableReason =
  | "bad_input"
  | "no_secret"
  | "guard"
  | "no_admin"
  | "rpc_error"
  | "non_boolean";

export type AuthRouteUnavailableReason =
  | "flag_off"
  | "auth_unconfigured"
  | "ip_rate_limit"
  | "email_rate_limit"
  | "no_server_client";

export type AuthLogFields = Record<string, string | boolean>;

/** Strip values that must never reach production logs. Idempotent. */
export function redactAuthLogText(value: string): string {
  const cleaned = value
    .replace(URL_TEXT, "[url]")
    .replace(SB_KEY, "[redacted]")
    .replace(JWT, "[redacted]")
    .replace(EMAIL, "[redacted]")
    .replace(HEX_BUCKET, "[redacted]")
    .replace(IPV4, "[ip]")
    .replace(IPV6, "[ip]")
    .replace(BEARER, "Bearer [redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  if (cleaned.length <= MAX_LOG_TEXT) return cleaned;
  return `${cleaned.slice(0, MAX_LOG_TEXT)}...`;
}

function asLogString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function readPostgrestError(error: unknown): {
  code: string;
  message: string;
  hint: string;
} {
  if (!error || typeof error !== "object") {
    return { code: "", message: "", hint: "" };
  }
  const record = error as { code?: unknown; message?: unknown; hint?: unknown };
  return {
    code: redactAuthLogText(asLogString(record.code)),
    message: redactAuthLogText(asLogString(record.message)),
    hint: redactAuthLogText(asLogString(record.hint)),
  };
}

function writeLog(level: "warn" | "error", event: string, fields: AuthLogFields): void {
  const reason = fields.reason;
  const safe: AuthLogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === "reason") continue;
    safe[key] = typeof value === "boolean" ? value : redactAuthLogText(value);
  }
  const reasonToken = typeof reason === "string" ? ` reason=${reason}` : "";
  const extra = Object.keys(safe).length > 0 ? ` ${JSON.stringify(safe)}` : "";
  const line = `${event}${reasonToken}${extra}`;
  if (level === "error") console.error(line);
  else console.warn(line);
}

export function logAuthRateLimitUnavailable(
  reason: AuthRateLimitUnavailableReason,
  fields: AuthLogFields = {},
): void {
  writeLog(reason === "rpc_error" ? "error" : "warn", "auth_rl_unavailable", {
    reason,
    ...fields,
  });
}

export function logAuthRouteUnavailable(
  route: "otp" | "verify",
  reason: AuthRouteUnavailableReason,
): void {
  writeLog("warn", `auth_${route}_unavailable`, { reason });
}

export function logAuthOtpSendFailed(error: unknown): void {
  const fields = readPostgrestError(error);
  writeLog("error", "auth_otp_send_failed", {
    code: fields.code,
    message: fields.message,
  });
}

/** Boolean shape of the service-role env only. Never the key, its length, or the URL. */
export function serviceRoleEnvFlags(
  env: Record<string, string | undefined> = process.env,
): {
  url_present: boolean;
  service_key_present: boolean;
  service_key_legacy_jwt: boolean;
  service_key_sb_secret: boolean;
} {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim() || "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const parts = key.split(".");
  return {
    url_present: url.length > 0,
    service_key_present: key.length > 0,
    service_key_legacy_jwt:
      key.startsWith("eyJ") && parts.length === 3 && parts.every((part) => part.length > 0),
    service_key_sb_secret: key.startsWith("sb_secret_"),
  };
}

export function rpcDataType(data: unknown): string {
  if (data === null) return "null";
  if (Array.isArray(data)) return "array";
  switch (typeof data) {
    case "string":
    case "number":
    case "boolean":
    case "undefined":
    case "object":
      return typeof data;
    default:
      return "other";
  }
}
