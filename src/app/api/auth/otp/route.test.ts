import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemoryRateLimitForTests } from "@/lib/memory-rate-limit";

const signInWithOtp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseAuthConfigured: () => true,
  createSupabaseServerClient: async () => ({
    auth: { signInWithOtp },
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
    resetMemoryRateLimitForTests();
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not create accounts or send mail while the feature flag is off", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "");
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
