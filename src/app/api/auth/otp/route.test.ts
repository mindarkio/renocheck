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

function request(email = "person@example.com") {
  return new Request("http://localhost/api/auth/otp", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.50",
    },
    body: JSON.stringify({ email }),
  });
}

describe("POST /api/auth/otp", () => {
  beforeEach(() => {
    resetMemoryRateLimitForTests();
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
