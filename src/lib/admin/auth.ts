import "server-only";

import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";

export const ADMIN_SESSION_COOKIE = "rc_admin";
export const ADMIN_SESSION_PATH = "/admin";
export const SESSION_MAX_AGE_SEC = 12 * 60 * 60;
export const SESSION_DURATION_MS = SESSION_MAX_AGE_SEC * 1000;

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_IP_FAILURES = 5;
const MAX_GLOBAL_FAILURES = 30;
const FAILED_DELAY_BASE_MS = 800;

/**
 * In-memory only; per serverless instance — IP rotation, scale-out and cold starts reset these counters.
 * Attempts are reserved synchronously *before* the PIN is checked, so concurrent requests cannot
 * all pass the lock check while earlier failures are still waiting out the delay.
 */
type IpState = { failures: number; windowStart: number; lockedUntil: number };
type GlobalState = { failures: number; windowStart: number; lockedUntil: number };

const ipAttempts = new Map<string, IpState>();
let globalState: GlobalState = {
  failures: 0,
  windowStart: 0,
  lockedUntil: 0,
};

export type AdminAuthConfig = {
  pinSha256: Buffer;
  sessionSecret: string;
};

export function resetAdminAuthStateForTests(): void {
  ipAttempts.clear();
  globalState = { failures: 0, windowStart: 0, lockedUntil: 0 };
}

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 32;
const PIN_DIGITS_RE = /^\d{4,32}$/;

/** Trimmed env PIN, or null when missing or not exactly 4–32 digits. */
export function getAdminEnvPin(): string | null {
  const pin = process.env.ADMIN_DASHBOARD_PIN?.trim() ?? "";
  if (!PIN_DIGITS_RE.test(pin)) return null;
  return pin;
}

export function getAdminAuthConfig(): AdminAuthConfig | null {
  const pin = getAdminEnvPin();
  const secret = process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
  if (!pin || !secret || secret.length < 32) return null;
  return {
    pinSha256: sha256Buffer(pin),
    sessionSecret: secret,
  };
}

export function isAdminDashboardEnabled(): boolean {
  return getAdminAuthConfig() !== null;
}

function sha256Buffer(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function pinDigestHex(pin: string): string {
  return sha256Buffer(pin).toString("hex");
}

/** Submitted value must be 4–32 digits; compare SHA-256 digests with timingSafeEqual. */
export function verifyAdminPin(submitted: string, config: AdminAuthConfig): boolean {
  const trimmed = submitted.trim();
  if (!PIN_DIGITS_RE.test(trimmed)) return false;
  const digest = sha256Buffer(trimmed);
  if (digest.length !== config.pinSha256.length) return false;
  return timingSafeEqual(digest, config.pinSha256);
}

export function clientIpFromForwarded(forwarded: string | null): string {
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

function pruneAttemptStores(now: number): void {
  for (const [ip, state] of ipAttempts) {
    if (now - state.windowStart > LOCKOUT_WINDOW_MS * 2 && now >= state.lockedUntil) {
      ipAttempts.delete(ip);
    }
  }
}

function isIpLocked(ip: string, now: number): boolean {
  const state = ipAttempts.get(ip);
  return state != null && now < state.lockedUntil;
}

function isGlobalLocked(now: number): boolean {
  return now < globalState.lockedUntil;
}

export type LoginAttemptResult =
  | { status: "ok" }
  | { status: "wrong" }
  | { status: "locked"; scope: "ip" | "global" };

export function getLoginBlockStatus(
  ip: string,
  now = Date.now(),
): "ip" | "global" | null {
  pruneAttemptStores(now);
  if (isGlobalLocked(now)) return "global";
  if (isIpLocked(ip, now)) return "ip";
  return null;
}

function rollWindows(ip: string, now: number): IpState {
  let ipState = ipAttempts.get(ip);
  if (!ipState || (now - ipState.windowStart > LOCKOUT_WINDOW_MS && now >= ipState.lockedUntil)) {
    ipState = { failures: 0, windowStart: now, lockedUntil: 0 };
    ipAttempts.set(ip, ipState);
  }
  if (now - globalState.windowStart > LOCKOUT_WINDOW_MS && now >= globalState.lockedUntil) {
    globalState = { failures: 0, windowStart: now, lockedUntil: 0 };
  }
  return ipState;
}

/**
 * Synchronously reserve one attempt (counted as a failure until proven otherwise).
 * Call before checking the PIN; call `finishLoginAttempt` afterwards.
 */
export function reserveLoginAttempt(
  ip: string,
  now = Date.now(),
): { status: "reserved" } | { status: "locked"; scope: "ip" | "global" } {
  pruneAttemptStores(now);
  if (isGlobalLocked(now)) {
    console.warn(JSON.stringify({ event: "admin_login_locked", scope: "global" }));
    return { status: "locked", scope: "global" };
  }
  if (isIpLocked(ip, now)) {
    console.warn(JSON.stringify({ event: "admin_login_locked", scope: "ip" }));
    return { status: "locked", scope: "ip" };
  }
  const ipState = rollWindows(ip, now);
  if (globalState.failures >= MAX_GLOBAL_FAILURES) {
    console.warn(JSON.stringify({ event: "admin_login_locked", scope: "global" }));
    return { status: "locked", scope: "global" };
  }
  if (ipState.failures >= MAX_IP_FAILURES) {
    console.warn(JSON.stringify({ event: "admin_login_locked", scope: "ip" }));
    return { status: "locked", scope: "ip" };
  }
  ipState.failures += 1;
  globalState.failures += 1;
  return { status: "reserved" };
}

/** Settle a reserved attempt. Success refunds the reservation and clears that IP's counter. */
export async function finishLoginAttempt(
  ip: string,
  success: boolean,
  now = Date.now(),
): Promise<LoginAttemptResult> {
  if (success) {
    ipAttempts.delete(ip);
    globalState.failures = Math.max(0, globalState.failures - 1);
    return { status: "ok" };
  }

  console.warn(JSON.stringify({ event: "admin_login_failed" }));
  const ipState = ipAttempts.get(ip);
  if (ipState && ipState.failures >= MAX_IP_FAILURES && ipState.lockedUntil <= now) {
    ipState.lockedUntil = now + LOCKOUT_WINDOW_MS;
    console.warn(JSON.stringify({ event: "admin_login_locked", scope: "ip" }));
  }
  if (globalState.failures >= MAX_GLOBAL_FAILURES && globalState.lockedUntil <= now) {
    globalState.lockedUntil = now + LOCKOUT_WINDOW_MS;
    console.warn(JSON.stringify({ event: "admin_login_locked", scope: "global" }));
  }
  await delayWithJitter(FAILED_DELAY_BASE_MS);

  if (isGlobalLocked(now)) return { status: "locked", scope: "global" };
  if (isIpLocked(ip, now)) return { status: "locked", scope: "ip" };
  return { status: "wrong" };
}

/** Reserve + settle in one call (tests and simple callers). */
export async function recordLoginAttempt(
  ip: string,
  success: boolean,
  now = Date.now(),
): Promise<LoginAttemptResult> {
  const reserved = reserveLoginAttempt(ip, now);
  if (reserved.status === "locked") return reserved;
  return finishLoginAttempt(ip, success, now);
}

function delayWithJitter(baseMs: number): Promise<void> {
  if (process.env.VITEST) return Promise.resolve();
  const jitter = Math.floor(Math.random() * 120);
  return new Promise((resolve) => {
    setTimeout(resolve, baseMs + jitter);
  });
}

export function pinHashSliceForSession(pin: string): string {
  return pinDigestHex(pin).slice(0, 16);
}

function sessionSignature(
  config: AdminAuthConfig,
  expiresAtMs: number,
  nonce: string,
  pin: string,
): string {
  // The PIN binding is part of the HMAC input only; it is never written into the cookie.
  return createHmac("sha256", config.sessionSecret)
    .update(`v1.${expiresAtMs}.${nonce}.${pinHashSliceForSession(pin)}`)
    .digest("hex");
}

/** Cookie value `v1.<expiresAtMs>.<nonce>.<sig>`; changing the PIN or the secret invalidates it. */
export function buildSessionToken(
  config: AdminAuthConfig,
  pin: string,
  nowMs: number,
  nonce = randomBytes(16).toString("hex"),
): string {
  const expiresAtMs = nowMs + SESSION_DURATION_MS;
  return `v1.${expiresAtMs}.${nonce}.${sessionSignature(config, expiresAtMs, nonce, pin)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  config: AdminAuthConfig,
  envPin: string,
  nowMs: number,
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [version, expiresRaw, nonce, sig] = parts;
  if (version !== "v1" || !/^\d{13,16}$/.test(expiresRaw) || !/^[0-9a-f]{32}$/.test(nonce)) {
    return false;
  }
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const expiresAtMs = Number(expiresRaw);
  if (nowMs >= expiresAtMs || expiresAtMs - nowMs > SESSION_DURATION_MS) return false;
  const expected = Buffer.from(sessionSignature(config, expiresAtMs, nonce, envPin), "hex");
  return timingSafeEqual(Buffer.from(sig, "hex"), expected);
}

export function sessionCookieOptions(maxAgeSec: number): {
  httpOnly: true;
  secure: true;
  sameSite: "strict";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: ADMIN_SESSION_PATH,
    maxAge: maxAgeSec,
  };
}

/** @internal test helper */
export function __testOnlySetIpState(ip: string, state: IpState): void {
  ipAttempts.set(ip, state);
}

export function __testOnlySetGlobalState(state: GlobalState): void {
  globalState = state;
}
