import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_UNAVAILABLE_ZH } from "@/lib/quote-analysis/copy";

const verifyOtp = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const rateHits = vi.hoisted(() => ({ map: new Map<string, number>() }));
const server = vi.hoisted(() => ({ configured: true, client: true }));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseAuthConfigured: () => server.configured,
  createSupabaseServerClient: async () => (server.client ? { auth: { verifyOtp } } : null),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ rpc }),
}));

import { POST } from "./route";

function request(
  body: unknown = { email: "person@example.com", token: "123456" },
  origin = "http://localhost",
  ip = "203.0.113.60",
) {
  return new Request("http://localhost/api/auth/verify", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/verify", () => {
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
    verifyOtp.mockReset();
    verifyOtp.mockResolvedValue({ data: {}, error: { message: "bad" } });
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "synthetic-auth-rate-limit-secret-value");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is off with the feature flag", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "");
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable", message: LOGIN_UNAVAILABLE_ZH });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("auth_verify_unavailable reason=flag_off");
    expect(logs()).not.toContain("person@example.com");
    expect(logs()).not.toContain("123456");
  });

  it("logs when auth env is missing and does not call the limiter", async () => {
    server.configured = false;
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable", message: LOGIN_UNAVAILABLE_ZH });
    expect(rpc).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("auth_verify_unavailable reason=auth_unconfigured");
  });

  it("does not verify when the durable limiter is down", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "down", hint: "reload" },
    });
    expect((await POST(request())).status).toBe(503);
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "permission denied", hint: "" },
    });
    expect((await POST(request())).status).toBe(503);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("auth_verify_unavailable reason=ip_rate_limit");
    expect(warn).toHaveBeenCalledWith("auth_verify_unavailable reason=email_rate_limit");
    const logged = logs();
    expect(logged).toContain("auth_rl_unavailable reason=rpc_error");
    expect(logged).toContain('"code":"PGRST202"');
    expect(logged).toContain('"hint":"reload"');
    expect(logged).not.toContain("person@example.com");
    expect(logged).not.toContain("123456");
    expect(logged).not.toContain("203.0.113.60");
    expect(logged).not.toContain("synthetic-auth-rate-limit-secret-value");
    expect(logged).not.toContain("test-service-role");
  });

  it("logs when the server auth client is missing", async () => {
    server.client = false;
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable", message: LOGIN_UNAVAILABLE_ZH });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("auth_verify_unavailable reason=no_server_client");
    expect(logs()).not.toContain("123456");
  });

  it("refuses cross-site posts", async () => {
    expect((await POST(request(undefined, "https://evil.example"))).status).toBe(403);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("only sends six-digit codes to Supabase", async () => {
    expect((await POST(request({ email: "person@example.com", token: "12345" }))).status).toBe(400);
    expect((await POST(request({ email: "person@example.com", token: 123456 }))).status).toBe(400);
    expect(verifyOtp).not.toHaveBeenCalled();
    verifyOtp.mockResolvedValueOnce({ data: {}, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(verifyOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      token: "123456",
      type: "email",
    });
  });

  it("caps guesses per email across addresses", async () => {
    for (let i = 0; i < 8; i += 1) {
      expect((await POST(request(undefined, undefined, `203.0.113.${i}`))).status).toBe(400);
    }
    expect((await POST(request(undefined, undefined, "203.0.113.99"))).status).toBe(429);
    expect(verifyOtp).toHaveBeenCalledTimes(8);
  });

  it("caps guesses per address across emails", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await POST(request({ email: `p${i}@example.com`, token: "123456" }))).status).toBe(400);
    }
    expect((await POST(request({ email: "p99@example.com", token: "123456" }))).status).toBe(429);
  });
});
