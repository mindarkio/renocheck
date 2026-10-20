import { createHmac, randomBytes } from "node:crypto";

export const DEVICE_COOKIE_NAME = "rc_did";

/** One year, in seconds. */
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const DEVICE_ID_RE = /^[0-9a-f]{32}$/;

/** Random 128-bit id, hex-encoded. */
export function createDeviceId(): string {
  return randomBytes(16).toString("hex");
}

export function readDeviceIdFromCookieHeader(
  header: string | null,
): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq);
    if (name !== DEVICE_COOKIE_NAME) continue;
    const value = trimmed.slice(eq + 1);
    if (DEVICE_ID_RE.test(value)) return value;
  }
  return null;
}

export function hashDeviceId(secret: string, deviceId: string): string {
  return createHmac("sha256", secret).update(deviceId).digest("hex");
}
