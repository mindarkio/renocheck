import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSessionToken,
  finishLoginAttempt,
  getAdminAuthConfig,
  getLoginBlockStatus,
  pinDigestHex,
  reserveLoginAttempt,
  resetAdminAuthStateForTests,
  SESSION_DURATION_MS,
  verifySessionToken,
} from "@/lib/admin/auth";
import { randomTestPin, randomTestSecret } from "@/lib/admin/test-helpers";

function enable(pinLen = 12) {
  const pin = randomTestPin(pinLen);
  vi.stubEnv("ADMIN_DASHBOARD_PIN", pin);
  vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
  return { pin, config: getAdminAuthConfig()! };
}

describe("admin auth hardening (PR #32 review)", () => {
  beforeEach(() => {
    resetAdminAuthStateForTests();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    resetAdminAuthStateForTests();
  });

  it("session cookie carries no PIN-derived value", () => {
    const { pin, config } = enable();
    const token = buildSessionToken(config, pin, Date.now());
    const parts = token.split(".");
    expect(parts).toHaveLength(4);
    const digest = pinDigestHex(pin);
    for (const part of parts) {
      expect(digest.includes(part) && part.length >= 8).toBe(false);
    }
    expect(token).not.toContain(digest.slice(0, 16));
  });

  it("concurrent attempts from one IP: only 5 reach the PIN check", async () => {
    const ip = "203.0.113.20";
    const reservations = Array.from({ length: 12 }, () => reserveLoginAttempt(ip));
    expect(reservations.filter((r) => r.status === "reserved")).toHaveLength(5);
    await Promise.all(
      reservations.filter((r) => r.status === "reserved").map(() => finishLoginAttempt(ip, false)),
    );
    expect(getLoginBlockStatus(ip)).toBe("ip");
  });

  it("concurrent attempts across IPs: only 30 reach the PIN check", () => {
    const reserved = Array.from({ length: 50 }, (_, i) => reserveLoginAttempt(`203.0.113.${i}`)).filter(
      (r) => r.status === "reserved",
    );
    expect(reserved).toHaveLength(30);
  });

  it("a correct PIN refunds its reservation and clears that IP", async () => {
    const ip = "203.0.113.30";
    for (let i = 0; i < 4; i++) {
      expect(reserveLoginAttempt(ip).status).toBe("reserved");
      await finishLoginAttempt(ip, false);
    }
    expect(reserveLoginAttempt(ip).status).toBe("reserved");
    expect((await finishLoginAttempt(ip, true)).status).toBe("ok");
    expect(getLoginBlockStatus(ip)).toBeNull();
  });

  it("rejects an altered expiry and an expiry beyond 12h", () => {
    const { pin, config } = enable();
    const now = Date.now();
    const token = buildSessionToken(config, pin, now);
    const [v, exp, nonce, sig] = token.split(".");
    expect(verifySessionToken([v, String(Number(exp) + 1), nonce, sig].join("."), config, pin, now)).toBe(false);
    const far = buildSessionToken(config, pin, now + SESSION_DURATION_MS);
    expect(verifySessionToken(far, config, pin, now)).toBe(false);
  });

  it("expires after 12h + 1s (fake timers)", () => {
    vi.useFakeTimers();
    const { pin, config } = enable();
    const token = buildSessionToken(config, pin, Date.now());
    expect(verifySessionToken(token, config, pin, Date.now())).toBe(true);
    vi.advanceTimersByTime(SESSION_DURATION_MS + 1000);
    expect(verifySessionToken(token, config, pin, Date.now())).toBe(false);
  });

  it("rotating the secret invalidates sessions", () => {
    const { pin, config } = enable();
    const token = buildSessionToken(config, pin, Date.now());
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    expect(verifySessionToken(token, getAdminAuthConfig()!, pin, Date.now())).toBe(false);
  });

  it("an env PIN outside 4–32 digits disables the dashboard", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    vi.stubEnv("ADMIN_DASHBOARD_PIN", "12ab");
    expect(getAdminAuthConfig()).toBeNull();
    vi.stubEnv("ADMIN_DASHBOARD_PIN", `${"9".repeat(33)}`);
    expect(getAdminAuthConfig()).toBeNull();
  });
});
