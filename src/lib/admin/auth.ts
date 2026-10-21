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

/** In-memory only; per serverless instance — IP rotation can bypass per-IP limits. */
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

export function getAdminAuthConfig(): AdminAuthConfig | null {
  const pin = process.env.ADMIN_DASHBOARD_PIN?.trim() ?? "";
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

/** Accept 4–32 characters; compare SHA-256 digests with timingSafeEqual. */
export function verifyAdminPin(submitted: string, config: AdminAuthConfig): boolean {
  const trimmed = submitted.trim();
  if (trimmed.length < 4 || trimmed.length > 32) return false;
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

export async function recordLoginAttempt(
  ip: string,
  success: boolean,
  now = Date.now(),
): Promise<LoginAttemptResult> {
  pruneAttemptStores(now);

  if (isGlobalLocked(now)) {
    console.warn(JSON.stringify({ event: "admin_login_locked", scope: "global" }));
    return { status: "locked", scope: "global" };
  }
  if (isIpLocked(ip, now)) {
    console.warn(JSON.stringify({ event: "admin_login_locked", scope: "ip" }));
    return { status: "locked", scope: "ip" };
  }

  if (success) {
    ipAttempts.delete(ip);
    return { status: "ok" };
  }

  await delayWithJitter(FAILED_DELAY_BASE_MS);
  console.warn(JSON.stringify({ event: "admin_login_failed" }));

  let ipState = ipAttempts.get(ip);
  if (!ipState || now - ipState.windowStart > LOCKOUT_WINDOW_MS) {
    ipState = { failures: 0, windowStart: now, lockedUntil: 0 };
  }
  ipState.failures += 1;
  if (ipState.failures >= MAX_IP_FAILURES) {
    ipState.lockedUntil = now + LOCKOUT_WINDOW_MS;
    console.warn(JSON.stringify({ event: "admin_login_locked", scope: "ip" }));
  }
  ipAttempts.set(ip, ipState);

  if (now - globalState.windowStart > LOCKOUT_WINDOW_MS) {
    globalState = { failures: 0, windowStart: now, lockedUntil: 0 };
  }
  globalState.failures += 1;
  if (globalState.failures >= MAX_GLOBAL_FAILURES) {
    globalState.lockedUntil = now + LOCKOUT_WINDOW_MS;
    console.warn(JSON.stringify({ event: "admin_login_locked", scope: "global" }));
  }

  if (isGlobalLocked(now)) return { status: "locked", scope: "global" };
  if (isIpLocked(ip, now)) return { status: "locked", scope: "ip" };
  return { status: "wrong" };
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

export function buildSessionToken(
  config: AdminAuthConfig,
  pin: string,
  nowMs: number,
  nonce = randomBytes(16).toString("hex"),
): string {
  const expiresAtMs = nowMs + SESSION_DURATION_MS;
  const pinSlice = pinHashSliceForSession(pin);
  const payload = `v1.${expiresAtMs}.${nonce}.${pinSlice}`;
  const sig = createHmac("sha256", config.sessionSecret)
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  config: AdminAuthConfig,
  envPin: string,
  nowMs: number,
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 5) return false;
  const [version, expiresRaw, nonce, pinSlice, sig] = parts;
  if (version !== "v1" || !expiresRaw || !nonce || !pinSlice || !sig) return false;
  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || nowMs >= expiresAtMs) return false;
  if (pinSlice !== pinHashSliceForSession(envPin)) return false;
  const payload = `v1.${expiresAtMs}.${nonce}.${pinSlice}`;
  const expected = createHmac("sha256", config.sessionSecret)
    .update(payload)
    .digest("hex");
  const actualBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (actualBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(actualBuf, expectedBuf);
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
