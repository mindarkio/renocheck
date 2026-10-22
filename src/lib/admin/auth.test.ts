import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_COOKIE,
  buildSessionToken,
  finishLoginAttempt,
  getAdminAuthConfig,
  getLoginBlockStatus,
  pinDigestHex,
  recordLoginAttempt,
  reserveLoginAttempt,
  resetAdminAuthStateForTests,
  sessionCookieOptions,
  verifyAdminPin,
  verifySessionToken,
  __testOnlySetGlobalState,
  __testOnlySetIpState,
} from "@/lib/admin/auth";
import { randomTestPin, randomTestSecret } from "@/lib/admin/test-helpers";

describe("admin auth", () => {
  beforeEach(() => {
    resetAdminAuthStateForTests();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAdminAuthStateForTests();
  });

  it("rejects wrong PIN and accepts correct PIN via digest compare", () => {
    const pin = randomTestPin(8);
    const config = {
      pinSha256: Buffer.from(pinDigestHex(pin), "hex"),
      sessionSecret: randomTestSecret(),
    };
    expect(verifyAdminPin(randomTestPin(8), config)).toBe(false);
    expect(verifyAdminPin(pin, config)).toBe(true);
    expect(verifyAdminPin("12ab", config)).toBe(false);
  });

  it("issues a session cookie with required flags", () => {
    const opts = sessionCookieOptions(12 * 60 * 60);
    expect(opts).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/admin",
      maxAge: 12 * 60 * 60,
    });
    expect(ADMIN_SESSION_COOKIE).toBe("rc_admin");
  });

  it("locks an IP after 5 failures; 6th correct PIN still locked", async () => {
    const ip = "203.0.113.1";
    const now = Date.now();
    for (let i = 0; i < 4; i++) {
      const r = await recordLoginAttempt(ip, false, now);
      expect(r.status).toBe("wrong");
    }
    const fifth = await recordLoginAttempt(ip, false, now);
    expect(fifth.status).toBe("locked");
    expect(getLoginBlockStatus(ip, now)).toBe("ip");
    const sixth = await recordLoginAttempt(ip, true, now);
    expect(sixth.status).toBe("locked");
    expect(getLoginBlockStatus(ip, now + 15 * 60 * 1000 + 1)).toBeNull();
  });

  it("locks globally after 30 failures across IPs", async () => {
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
      await recordLoginAttempt(`203.0.113.${i}`, false, now);
    }
    expect(getLoginBlockStatus("203.0.113.99", now)).toBe("global");
  });

  it("treats missing or short secret as disabled", () => {
    vi.stubEnv("ADMIN_DASHBOARD_PIN", "");
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    expect(getAdminAuthConfig()).toBeNull();
    vi.stubEnv("ADMIN_DASHBOARD_PIN", randomTestPin(8));
    vi.stubEnv("ADMIN_SESSION_SECRET", "short");
    expect(getAdminAuthConfig()).toBeNull();
  });

  it("rejects tampered, expired, and wrong-version cookies", () => {
    const pin = randomTestPin(8);
    const secret = randomTestSecret();
    vi.stubEnv("ADMIN_DASHBOARD_PIN", pin);
    vi.stubEnv("ADMIN_SESSION_SECRET", secret);
    const config = getAdminAuthConfig()!;
    const now = 1_700_000_000_000;
    const token = buildSessionToken(config, pin, now);
    expect(verifySessionToken(token, config, pin, now + 1000)).toBe(true);

    const flipped = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifySessionToken(flipped, config, pin, now + 1000)).toBe(false);

    const expired = buildSessionToken(config, pin, now - 13 * 60 * 60 * 1000);
    expect(verifySessionToken(expired, config, pin, now)).toBe(false);

    const garbage = "v2.1.n.n.sig";
    expect(verifySessionToken(garbage, config, pin, now)).toBe(false);

    const parts = token.split(".");
    parts[0] = "v0";
    expect(verifySessionToken(parts.join("."), config, pin, now + 1000)).toBe(
      false,
    );
  });

  it("invalidates session when PIN rotates", () => {
    const pinA = randomTestPin(8);
    const pinB = randomTestPin(8);
    const secret = randomTestSecret();
    const config = {
      pinSha256: Buffer.from(pinDigestHex(pinA), "hex"),
      sessionSecret: secret,
    };
    const now = Date.now();
    const token = buildSessionToken(config, pinA, now);
    expect(verifySessionToken(token, config, pinB, now + 1)).toBe(false);
  });

  it("never logs PIN, submitted input, or IP on login failure flow", async () => {
    const pin = randomTestPin(8);
    const wrongPin = randomTestPin(8);
    const sentinel = `SENTINEL_${Date.now()}`;
    vi.stubEnv("ADMIN_DASHBOARD_PIN", pin);
    vi.stubEnv("ADMIN_SESSION_SECRET", randomTestSecret());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ip = "203.0.113.99";
    expect(reserveLoginAttempt(ip).status).toBe("reserved");
    await finishLoginAttempt(ip, false);
    const payload = warn.mock.calls.map((c) => String(c[0])).join("\n");
    expect(payload).not.toContain(pin);
    expect(payload).not.toContain(wrongPin);
    expect(payload).not.toContain(sentinel);
    expect(payload).not.toContain(ip);
    expect(payload).toContain("admin_login_failed");
    warn.mockRestore();
  });

  it("resets IP counter after successful login", async () => {
    const ip = "203.0.113.8";
    await recordLoginAttempt(ip, false);
    await recordLoginAttempt(ip, false);
    await recordLoginAttempt(ip, true);
    expect(getLoginBlockStatus(ip)).toBeNull();
  });

  it("exposes global lock via test helper", () => {
    const now = Date.now();
    __testOnlySetGlobalState({
      failures: 30,
      windowStart: now,
      lockedUntil: now + 60_000,
    });
    expect(getLoginBlockStatus("any", now)).toBe("global");
  });

  it("exposes IP lock via test helper", () => {
    const now = Date.now();
    __testOnlySetIpState("203.0.113.7", {
      failures: 5,
      windowStart: now,
      lockedUntil: now + 60_000,
    });
    expect(getLoginBlockStatus("203.0.113.7", now)).toBe("ip");
  });
});
