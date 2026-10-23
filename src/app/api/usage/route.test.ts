import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimitForTests } from "@/lib/rate-limit";

const ANON = "12345678-1234-4234-8234-123456789abc";
const FP = "cd".repeat(16);

const { admin } = vi.hoisted(() => {
  const insert = vi.fn();
  const maybeSingle = vi.fn();
  const from = vi.fn((table: string) => {
    if (table === "search_cache") {
      return { select: () => ({ eq: () => ({ maybeSingle }) }) };
    }
    return { insert };
  });
  const getSupabaseAdmin = vi.fn(() => ({ from }));
  return { admin: { insert, maybeSingle, from, getSupabaseAdmin } };
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => admin.getSupabaseAdmin(),
  isSupabaseAdminConfigured: () => true,
}));

import { POST } from "./route";

function request(
  payload: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost/api/usage", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "x-forwarded-for": "203.0.113.40",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/usage", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("VERCEL_ENV", "test");
    resetRateLimitForTests();
    admin.insert.mockReset();
    admin.insert.mockResolvedValue({ error: null });
    admin.maybeSingle.mockReset();
    admin.maybeSingle.mockResolvedValue({ data: null, error: null });
    admin.from.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("stores anon id, event type, and fingerprint only", async () => {
    const res = await POST(
      request({ anonId: ANON.toUpperCase(), eventType: "report_share", fingerprint: FP }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(admin.insert).toHaveBeenCalledTimes(1);
    expect(admin.insert.mock.calls[0][0]).toEqual({
      anon_id: ANON,
      event_type: "report_share",
      fingerprint: FP,
    });
    expect(JSON.stringify(admin.insert.mock.calls)).not.toContain("203.0.113.40");
    expect(admin.insert.mock.calls[0][0]).not.toHaveProperty("ip");
    expect(admin.insert.mock.calls[0][0]).not.toHaveProperty("user_agent");
  });

  it("rejects an invalid id and extra personal fields", async () => {
    const invalid = await POST(request({ anonId: "nope", eventType: "quote_page" }));
    expect(invalid.status).toBe(400);
    const extra = await POST(
      request({
        anonId: ANON,
        eventType: "quote_copy_reply",
        companyName: "示例裝修有限公司",
      }),
    );
    expect(extra.status).toBe(400);
    expect(admin.insert).not.toHaveBeenCalled();
  });

  it("rate limits with the same 5-per-minute window as search", async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await POST(request({ anonId: ANON, eventType: "quote_page" }));
      expect(res.status).toBe(204);
    }
    const blocked = await POST(request({ anonId: ANON, eventType: "quote_page" }));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited" });
    expect(admin.insert).toHaveBeenCalledTimes(5);
  });

  it("skips the insert when the table does not exist yet", async () => {
    admin.insert.mockResolvedValue({
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.usage_events' in the schema cache",
      },
    });
    const res = await POST(request({ anonId: ANON, eventType: "quote_all_ticked" }));
    expect(res.status).toBe(204);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("does not store a ZZQ probe report event", async () => {
    admin.maybeSingle.mockResolvedValue({
      data: { term: "ZZQ_audit probe" },
      error: null,
    });
    const res = await POST(
      request({
        anonId: ANON,
        eventType: "report_official_link",
        fingerprint: FP,
      }),
    );
    expect(res.status).toBe(204);
    expect(admin.insert).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin post before writing", async () => {
    const res = await POST(
      request(
        { anonId: ANON, eventType: "quote_page" },
        { origin: "https://example.invalid" },
      ),
    );
    expect(res.status).toBe(403);
    expect(admin.insert).not.toHaveBeenCalled();
  });

  it("rejects a post with no Origin header", async () => {
    const req = new Request("http://localhost/api/usage", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.40" },
      body: JSON.stringify({ anonId: ANON, eventType: "quote_page" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(admin.insert).not.toHaveBeenCalled();
  });

  it("rejects a body over 1 KB, counted in bytes", async () => {
    const big = await POST(
      request({ anonId: ANON, eventType: "quote_page", pad: "x".repeat(2000) }),
    );
    expect(big.status).toBe(413);
    const wide = await POST(
      request({ anonId: ANON, eventType: "quote_page", pad: "字".repeat(400) }),
    );
    expect(wide.status).toBe(413);
    expect(admin.insert).not.toHaveBeenCalled();
  });

  it("rejects bad JSON, an unknown event, a non-v4 id, and a bad fingerprint", async () => {
    const badJson = new Request("http://localhost/api/usage", {
      method: "POST",
      headers: { origin: "http://localhost", "x-forwarded-for": "203.0.113.41" },
      body: "{",
    });
    expect((await POST(badJson)).status).toBe(400);
    expect(
      (await POST(request({ anonId: ANON, eventType: "search" }, { "x-forwarded-for": "203.0.113.42" }))).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request(
            { anonId: "12345678-1234-1234-8234-123456789abc", eventType: "quote_page" },
            { "x-forwarded-for": "203.0.113.43" },
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request(
            { anonId: ANON, eventType: "report_share", fingerprint: "zz" },
            { "x-forwarded-for": "203.0.113.44" },
          ),
        )
      ).status,
    ).toBe(400);
    expect(admin.insert).not.toHaveBeenCalled();
  });

  it("does not use up the search rate limit", async () => {
    for (let i = 0; i < 5; i += 1) {
      await POST(request({ anonId: ANON, eventType: "quote_page" }));
    }
    expect(checkRateLimit("203.0.113.40")).toBe(true);
  });
});
