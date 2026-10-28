import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logAuthOtpSendFailed,
  redactAuthLogText,
  serviceRoleEnvFlags,
} from "@/lib/auth/diagnostics";

describe("auth diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("redacts addresses, buckets, keys, and bearer tokens", () => {
    const email = "person@example.com";
    const bucket = "ab".repeat(32);
    const secret = "sb_secret_syntheticexamplekeyvalue";
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig";
    const text = redactAuthLogText(
      `failed ${email}\nbucket ${bucket}\nkey ${secret}\nBearer ${jwt}`,
    );
    expect(text).not.toContain(email);
    expect(text).not.toContain(bucket);
    expect(text).not.toContain(secret);
    expect(text).not.toContain(jwt);
    expect(text).not.toContain("\n");
    expect(text).toContain("[redacted]");
    expect(text).toContain("Bearer [redacted]");
  });

  it("logs signInWithOtp code and message only", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    logAuthOtpSendFailed({
      code: "unexpected_failure",
      message: "send failed for person@example.com",
      hint: "sb_secret_syntheticexamplekeyvalue",
      token: "123456",
    });
    expect(errorLog).toHaveBeenCalledTimes(1);
    const line = String(errorLog.mock.calls[0]?.[0]);
    expect(line).toBe(
      'auth_otp_send_failed {"code":"unexpected_failure","message":"send failed for [redacted]"}',
    );
    expect(line).not.toContain("person@example.com");
    expect(line).not.toContain("sb_secret_");
    expect(line).not.toContain("123456");
    expect(line).not.toContain("hint");
    expect(line).not.toContain("token");
  });

  it("redacts any address GoTrue echoes, plus IPs and URLs", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const echoed = [
      "用戶@例子.香港",
      "o'neil.synthetic@example.com",
      "a!b#c@example.test",
      "person@example.com",
    ];
    for (const email of echoed) {
      logAuthOtpSendFailed({
        code: "email_address_invalid",
        message: `Email address "${email}" is invalid`,
      });
    }
    logAuthOtpSendFailed({
      code: "",
      message:
        "TypeError: Failed to parse URL from https://synthetic-ref.supabase.co/auth/v1/otp from 203.0.113.9 and 2001:db8:85a3::8a2e:370:7334",
    });
    const logged = errorLog.mock.calls.map((call) => String(call[0])).join("\n");
    for (const email of echoed) {
      expect(logged).not.toContain(email);
      expect(logged).not.toContain(email.split("@")[0]);
    }
    expect(logged).toContain('"message":"Email address [redacted] is invalid"');
    expect(logged).not.toContain("synthetic-ref");
    expect(logged).not.toContain("203.0.113.9");
    expect(logged).not.toContain("2001:db8");
    expect(logged).toContain("[url]");
    expect(logged).toContain("[ip]");
    expect(redactAuthLogText("Authorization: Bearer opaque-synthetic-token")).toBe(
      "Authorization: Bearer [redacted]",
    );
    const long = redactAuthLogText("x".repeat(1_000));
    expect(long).toHaveLength(243);
    expect(long.endsWith("...")).toBe(true);
    expect(redactAuthLogText("function pg_catalog.least(integer, integer) does not exist")).toBe(
      "function pg_catalog.least(integer, integer) does not exist",
    );
  });

  it("reports service-role key shape as booleans", () => {
    const secret = "sb_secret_syntheticexamplekeyvalue";
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig";
    const flags = serviceRoleEnvFlags({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
      SUPABASE_SERVICE_ROLE_KEY: secret,
    });
    expect(flags).toEqual({
      url_present: true,
      service_key_present: true,
      service_key_legacy_jwt: false,
      service_key_sb_secret: true,
    });
    expect(JSON.stringify(flags)).not.toContain(secret);
    expect(JSON.stringify(flags)).not.toContain("example.invalid");
    expect(
      serviceRoleEnvFlags({
        SUPABASE_URL: "https://example.invalid",
        SUPABASE_SERVICE_ROLE_KEY: ` ${jwt} `,
      }),
    ).toMatchObject({
      url_present: true,
      service_key_present: true,
      service_key_legacy_jwt: true,
      service_key_sb_secret: false,
    });
    expect(
      serviceRoleEnvFlags({ SUPABASE_SERVICE_ROLE_KEY: "   " }),
    ).toMatchObject({
      url_present: false,
      service_key_present: false,
      service_key_legacy_jwt: false,
      service_key_sb_secret: false,
    });
  });
});
