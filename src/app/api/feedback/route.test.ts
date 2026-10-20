import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REPORT_VERSION } from "@/lib/constants";
import * as rateLimit from "@/lib/feedback/rate-limit";
import { resetFeedbackRateLimitForTests } from "@/lib/feedback/rate-limit";

const FP = "ab".repeat(16);

const { admin } = vi.hoisted(() => {
  const upsert = vi.fn();
  const maybeSingle = vi.fn();
  const from = vi.fn((table: string) => {
    if (table === "search_cache") {
      return { select: () => ({ eq: () => ({ maybeSingle }) }) };
    }
    return { upsert };
  });
  const getSupabaseAdmin = vi.fn(() => ({ from }));
  return { admin: { upsert, maybeSingle, from, getSupabaseAdmin } };
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => admin.getSupabaseAdmin(),
  isSupabaseAdminConfigured: () => true,
}));

import { POST } from "./route";

function body(overrides: Record<string, unknown> = {}) {
  return {
    surface: "company_report",
    reportRef: FP,
    rating: "up",
    placement: "inline",
    ...overrides,
  };
}

function request(
  payload: Record<string, unknown> = body(),
  headers: Record<string, string> = {},
  options: { origin?: string | null } = {},
) {
  const origin = options.origin === undefined ? "http://localhost" : options.origin;
  const merged: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": "203.0.113.10",
    ...headers,
  };
  if (origin) merged.origin = origin;
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: merged,
    body: JSON.stringify(payload),
  });
}

function infoLogs(): string {
  return vi
    .mocked(console.info)
    .mock.calls.map((call) => call.map((part) => String(part)).join(" "))
    .join("\n");
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.stubEnv("FEEDBACK_ENABLED", "1");
    vi.stubEnv("QUOTE_HASH_SECRET", "unit-test-secret");
    vi.stubEnv("VERCEL_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    resetFeedbackRateLimitForTests();
    admin.upsert.mockReset();
    admin.upsert.mockResolvedValue({ error: null });
    admin.maybeSingle.mockReset();
    admin.maybeSingle.mockResolvedValue({
      data: { fingerprint: FP },
      error: null,
    });
    admin.from.mockClear();
    admin.getSupabaseAdmin.mockClear();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 204, upserts, and sets rc_did only on this POST", async () => {
    const res = await POST(request());
    expect(res.status).toBe(204);
    expect(admin.upsert).toHaveBeenCalledOnce();
    const row = admin.upsert.mock.calls[0][0];
    expect(row.surface).toBe("company_report");
    expect(row.report_ref).toBe(FP);
    expect(row.rating).toBe("up");
    expect(row.placement).toBe("inline");
    expect(row.comment).toBeNull();
    expect(row.report_version).toBe(REPORT_VERSION);
    expect(REPORT_VERSION).toBe("2.6.0");
    expect(row.device_hash).toMatch(/^[0-9a-f]{64}$/);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("rc_did=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=31536000");
    expect(infoLogs()).not.toContain("rc_did=");
  });

  it("rejects quote_analysis, a bad ref, and an over-long comment", async () => {
    expect((await POST(request(body({ surface: "quote_analysis" })))).status).toBe(
      400,
    );
    expect((await POST(request(body({ reportRef: "xyz" })))).status).toBe(400);
    expect(
      (await POST(request(body({ comment: "字".repeat(501) })))).status,
    ).toBe(400);
    expect(admin.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown ref and logs feedback_ref_missing without the comment", async () => {
    admin.maybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(
      request(body({ comment: "SENTINEL-COMMENT-找不到" })),
    );
    expect(res.status).toBe(404);
    expect(infoLogs()).toContain("feedback_ref_missing");
    expect(infoLogs()).not.toContain("SENTINEL-COMMENT");
    expect(admin.upsert).not.toHaveBeenCalled();
  });

  it("upserts a changed vote for the same device", async () => {
    const first = await POST(request(body({ rating: "up" })));
    const setCookie = first.headers.get("set-cookie") ?? "";
    const id = /rc_did=([0-9a-f]{32})/.exec(setCookie)?.[1];
    expect(id).toBeTruthy();
    const second = await POST(
      request(body({ rating: "down", comment: "改投票" }), {
        cookie: `rc_did=${id}`,
        "x-forwarded-for": "203.0.113.11",
      }),
    );
    expect(second.status).toBe(204);
    expect(admin.upsert).toHaveBeenCalledTimes(2);
    expect(admin.upsert.mock.calls[0][0].device_hash).toBe(
      admin.upsert.mock.calls[1][0].device_hash,
    );
    expect(admin.upsert.mock.calls[1][0].rating).toBe("down");
    expect(admin.upsert.mock.calls[1][1]).toEqual({
      onConflict: "surface,report_ref,device_hash",
    });
  });

  it("rate limits the 11th request from the same IP", async () => {
    let cookie = "";
    for (let i = 0; i < 10; i += 1) {
      const res = await POST(
        request(body({ reportRef: i.toString(16).padStart(32, "0") }), {
          ...(cookie ? { cookie } : {}),
          "x-forwarded-for": "203.0.113.10",
        }),
      );
      expect(res.status).toBe(204);
      if (!cookie) {
        const id = /rc_did=([0-9a-f]{32})/.exec(
          res.headers.get("set-cookie") ?? "",
        )?.[1];
        cookie = `rc_did=${id}`;
      }
    }
    const limited = await POST(
      request(body({ reportRef: "f".repeat(32) }), {
        cookie,
        "x-forwarded-for": "203.0.113.10",
      }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a non-JSON content type, a foreign origin, and a missing origin without a cookie", async () => {
    const plain = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          origin: "http://localhost",
          "x-forwarded-for": "203.0.113.40",
        },
        body: "hello",
      }),
    );
    expect(plain.status).toBe(415);
    expect(plain.headers.get("set-cookie")).toBeNull();

    const evil = await POST(
      request(body(), { "x-forwarded-for": "203.0.113.41" }, {
        origin: "https://evil.example",
      }),
    );
    expect(evil.status).toBe(403);
    expect(evil.headers.get("set-cookie")).toBeNull();

    const missing = await POST(
      request(body(), { "x-forwarded-for": "203.0.113.42" }, { origin: null }),
    );
    expect(missing.status).toBe(403);
    expect(missing.headers.get("set-cookie")).toBeNull();
    expect(admin.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("caps new device ids and votes per report per IP", async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await POST(
        request(body({ reportRef: i.toString(16).padStart(32, "a") }), {
          "x-forwarded-for": "203.0.113.20",
        }),
      );
      expect(res.status).toBe(204);
    }
    const fourthDevice = await POST(
      request(body({ reportRef: "b".repeat(32) }), {
        "x-forwarded-for": "203.0.113.20",
      }),
    );
    expect(fourthDevice.status).toBe(429);
    expect(fourthDevice.headers.get("set-cookie")).toBeNull();

    const ref = "c".repeat(32);
    let cookie = "";
    for (let i = 0; i < 3; i += 1) {
      const res = await POST(
        request(body({ reportRef: ref }), {
          "x-forwarded-for": "203.0.113.21",
          ...(cookie ? { cookie } : {}),
        }),
      );
      expect(res.status).toBe(204);
      if (!cookie) {
        const id = /rc_did=([0-9a-f]{32})/.exec(
          res.headers.get("set-cookie") ?? "",
        )?.[1];
        cookie = `rc_did=${id}`;
      }
    }
    const fourthVote = await POST(
      request(body({ reportRef: ref }), {
        "x-forwarded-for": "203.0.113.21",
        cookie,
      }),
    );
    expect(fourthVote.status).toBe(429);
    expect(fourthVote.headers.get("set-cookie")).toBeNull();
  });

  it("rejects an oversized body before parsing", async () => {
    const raw = "x".repeat(4097);
    const res = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "content-length": String(raw.length),
          "x-forwarded-for": "203.0.113.43",
        },
        body: raw,
      }),
    );
    expect(res.status).toBe(413);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(admin.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 503 when the flag is off, the secret is missing, or the table is missing", async () => {
    const spy = vi.spyOn(rateLimit, "checkFeedbackRateLimit");
    vi.stubEnv("FEEDBACK_ENABLED", "");
    const disabled = await POST(
      request({ nope: true }, { "x-forwarded-for": "203.0.113.30" }),
    );
    expect(disabled.status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
    expect(admin.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(disabled.headers.get("set-cookie")).toBeNull();
    spy.mockRestore();

    vi.stubEnv("FEEDBACK_ENABLED", "1");
    vi.stubEnv("QUOTE_HASH_SECRET", "");
    const missingSecret = await POST(
      request(body(), { "x-forwarded-for": "203.0.113.12" }),
    );
    expect(missingSecret.status).toBe(503);
    expect(admin.getSupabaseAdmin).not.toHaveBeenCalled();

    vi.stubEnv("QUOTE_HASH_SECRET", "unit-test-secret");
    admin.upsert.mockResolvedValue({
      error: {
        code: "PGRST205",
        message:
          "Could not find the table 'public.report_feedback' in the schema cache",
      },
    });
    const missingTable = await POST(
      request(body(), { "x-forwarded-for": "203.0.113.13" }),
    );
    expect(missingTable.status).toBe(503);
  });

  it("refuses the prod database outside production", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://lvrasvtilgzwtfsfjbzd.supabase.co",
    );
    vi.stubEnv("VERCEL_ENV", "preview");
    const res = await POST(
      request(body(), { "x-forwarded-for": "203.0.113.14" }),
    );
    expect(res.status).toBe(503);
    expect(admin.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(infoLogs()).toContain("refusing_prod_db");
  });

  it("redacts the stored comment and does not log the comment, cookie, or IP", async () => {
    const comment = "請打 91234567 同 secret@example.com \u0007\u202E陳生";
    const res = await POST(
      request(body({ comment }), {
        cookie: "rc_did=" + "cd".repeat(16),
        "x-forwarded-for": "203.0.113.55",
      }),
    );
    expect(res.status).toBe(204);
    const stored = admin.upsert.mock.calls[0][0].comment as string;
    expect(stored).not.toContain("91234567");
    expect(stored).not.toContain("example.com");
    expect(stored).not.toContain("陳生");
    expect(stored).not.toContain("\u0007");
    expect(stored).not.toContain("\u202E");
    expect(stored).toContain("[電話]");
    expect(stored).toContain("[電郵]");
    expect(stored).toContain("[姓名]");

    const logs = [
      infoLogs(),
      vi.mocked(console.error).mock.calls.join("\n"),
      vi.mocked(console.warn).mock.calls.join("\n"),
      vi.mocked(console.log).mock.calls.join("\n"),
    ].join("\n");
    expect(logs).not.toContain(comment);
    expect(logs).not.toContain("91234567");
    expect(logs).not.toContain("secret@example.com");
    expect(logs).not.toContain("203.0.113.55");
    expect(logs).not.toContain("cd".repeat(16));
  });
});
