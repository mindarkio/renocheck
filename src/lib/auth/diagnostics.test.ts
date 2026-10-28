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
