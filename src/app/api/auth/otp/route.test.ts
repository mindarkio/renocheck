import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const rateHits = vi.hoisted(() => ({ map: new Map<string, number>() }));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseAuthConfigured: () => true,
  createSupabaseServerClient: async () => ({
    auth: { signInWithOtp },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    rpc,
    from: () => ({
      select: () => ({
        eq: (_column: string, bucket: string) => ({
          maybeSingle: async () => {
            const hits = rateHits.map.get(bucket) ?? 0;
            if (hits < 1) return { data: null, error: null };
            return { data: { hit_count: hits }, error: null };
          },
        }),
      }),
    }),
  }),
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
  beforeEach(() => {
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
    expect((await POST(request())).status).toBe(503);
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not send a code when the durable limiter is down", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect((await POST(request())).status).toBe(503);
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect((await POST(request())).status).toBe(503);
    expect(signInWithOtp).not.toHaveBeenCalled();
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
  });
});
