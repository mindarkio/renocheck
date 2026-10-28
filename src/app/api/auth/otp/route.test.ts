import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_SEND_FAILED_ZH, LOGIN_UNAVAILABLE_ZH } from "@/lib/quote-analysis/copy";

const signInWithOtp = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const rateHits = vi.hoisted(() => ({ map: new Map<string, number>() }));
const server = vi.hoisted(() => ({ configured: true, client: true }));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseAuthConfigured: () => server.configured,
  createSupabaseServerClient: async () =>
    server.client ? { auth: { signInWithOtp } } : null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ rpc }),
}));

import { POST } from "./route";

function request(
  email = "person@example.com",
  origin = "http://localhost",
  ip = "203.0.113.50",
) {
  return new Request("http://localhost/api/auth/otp", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ email }),
  });
}

describe("POST /api/auth/otp", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let errorLog: ReturnType<typeof vi.spyOn>;

  function logs(): string {
    return [...warn.mock.calls, ...errorLog.mock.calls].map((call) => String(call[0])).join("\n");
  }

  beforeEach(() => {
    server.configured = true;
    server.client = true;
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    rateHits.map.clear();
    rpc.mockReset();
    rpc.mockImplementation(
      async (
        fn: string,
        args: { p_bucket: string; p_limit: number },
      ) => {
        if (fn !== "take_auth_rate_limit") return { data: null, error: { message: "no" } };
        const next = (rateHits.map.get(args.p_bucket) ?? 0) + 1;
        rateHits.map.set(args.p_bucket, next);
        return { data: next <= args.p_limit, error: null };
      },
    );
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "synthetic-auth-rate-limit-secret-value");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not create accounts or send mail while the feature flag is off", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "");
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable", message: LOGIN_UNAVAILABLE_ZH });
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("auth_otp_unavailable reason=flag_off");
    expect(logs()).not.toContain("person@example.com");
  });

  it("logs when auth env is missing and does not call the limiter", async () => {
    server.configured = false;
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable", message: LOGIN_UNAVAILABLE_ZH });
    expect(rpc).not.toHaveBeenCalled();
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("auth_otp_unavailable reason=auth_unconfigured");
  });

  it("does not send a code when the durable limiter is down", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "down", hint: "reload" } });
    const first = await POST(request());
    expect(first.status).toBe(503);
    expect(await first.json()).toEqual({ error: "unavailable", message: LOGIN_UNAVAILABLE_ZH });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "permission denied", hint: "" } });
    const second = await POST(request());
    expect(second.status).toBe(503);
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("auth_otp_unavailable reason=ip_rate_limit");
    expect(warn).toHaveBeenCalledWith("auth_otp_unavailable reason=email_rate_limit");
    const logged = logs();
    expect(logged).toContain("auth_rl_unavailable reason=rpc_error");
    expect(logged).toContain('"code":"PGRST202"');
    expect(logged).toContain('"message":"down"');
    expect(logged).toContain('"hint":"reload"');
    expect(logged).toContain('"code":"42501"');
    expect(logged).not.toContain("person@example.com");
    expect(logged).not.toContain("203.0.113.50");
    expect(logged).not.toContain("synthetic-auth-rate-limit-secret-value");
    expect(logged).not.toContain("test-service-role");
  });

  it("does not send a code when the rate-limit secret is missing", async () => {
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "");
    expect((await POST(request())).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'auth_rl_unavailable reason=no_secret {"secret_present":false}',
    );
    expect(warn).toHaveBeenCalledWith("auth_otp_unavailable reason=ip_rate_limit");
    expect(logs()).not.toContain("203.0.113.50");
  });

  it("refuses a full limiter table instead of sending uncounted codes", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await POST(request("new@example.com", undefined, "198.51.100.7"))).status).toBe(429);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("rate limits one IPv6 /64 across many addresses", async () => {
    for (let i = 1; i <= 5; i += 1) {
      const res = await POST(request(`v${i}@example.com`, undefined, `2001:db8:1:2::${i}`));
      expect(res.status).toBe(200);
    }
    expect((await POST(request("v9@example.com", undefined, "2001:db8:1:2:ffff::9"))).status).toBe(
      429,
    );
    expect((await POST(request("w1@example.com", undefined, "2001:db8:1:3::1"))).status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledTimes(6);
  });

  it("refuses cross-site posts", async () => {
    expect((await POST(request(undefined, "https://evil.example"))).status).toBe(403);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("rate limits one address across many emails", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await POST(request(`p${i}@example.com`))).status).toBe(200);
    }
    expect((await POST(request("p9@example.com"))).status).toBe(429);
    expect(signInWithOtp).toHaveBeenCalledTimes(5);
  });

  it("asks Supabase for a code and does not call Resend or fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: { shouldCreateUser: true },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    const source = signInWithOtp.mock.calls[0]?.[0] as { options?: { emailRedirectTo?: string } };
    expect(source.options?.emailRedirectTo).toBeUndefined();
  });

  it("rate limits repeated code requests for the same email", async () => {
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    const blocked = await POST(request());
    expect(blocked.status).toBe(429);
    expect(signInWithOtp).toHaveBeenCalledTimes(3);
    expect(logs()).toBe("");
  });

  it("logs a send failure without the address or the code", async () => {
    const bucket = "ab".repeat(32);
    signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: {
        code: "over_email_send_rate_limit",
        message: `Email rate limit exceeded for person@example.com bucket ${bucket}`,
        hint: "sb_secret_syntheticexamplekeyvalue",
      },
    });
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "unavailable",
      message: LOGIN_SEND_FAILED_ZH,
    });
    expect(errorLog).toHaveBeenCalledTimes(1);
    const logged = String(errorLog.mock.calls[0]?.[0]);
    expect(logged).toContain("auth_otp_send_failed");
    expect(logged).toContain('"code":"over_email_send_rate_limit"');
    expect(logged).toContain("Email rate limit exceeded for [redacted]");
    expect(logged).toContain("[redacted]");
    expect(logged).not.toContain("person@example.com");
    expect(logged).not.toContain(bucket);
    expect(logged).not.toContain("sb_secret_syntheticexamplekeyvalue");
    expect(logged).not.toContain("hint");
  });

  it("logs when the server auth client is missing", async () => {
    server.client = false;
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable", message: LOGIN_UNAVAILABLE_ZH });
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("auth_otp_unavailable reason=no_server_client");
  });
});
