import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const rateHits = vi.hoisted(() => ({ map: new Map<string, number>() }));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseAuthConfigured: () => true,
  createSupabaseServerClient: async () => ({ auth: { verifyOtp } }),
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
    verifyOtp.mockReset();
    verifyOtp.mockResolvedValue({ data: {}, error: { message: "bad" } });
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "synthetic-auth-rate-limit-secret-value");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off with the feature flag", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "");
    expect((await POST(request())).status).toBe(503);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("does not verify when the durable limiter is down", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect((await POST(request())).status).toBe(503);
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect((await POST(request())).status).toBe(503);
    expect(verifyOtp).not.toHaveBeenCalled();
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
