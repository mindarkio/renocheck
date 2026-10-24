import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { feedbackPurgeCutoff } from "@/lib/feedback/store";

const { admin } = vi.hoisted(() => {
  const lt = vi.fn();
  const deleteFn = vi.fn(() => ({ lt }));
  const from = vi.fn(() => ({ delete: deleteFn }));
  const getSupabaseAdmin = vi.fn(() => ({ from }));
  return { admin: { lt, deleteFn, from, getSupabaseAdmin } };
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => admin.getSupabaseAdmin(),
  isSupabaseAdminConfigured: () => true,
}));

import { GET } from "./route";

function authed(secret = "cron-test-secret") {
  return new Request("http://localhost/api/cron/purge-feedback", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/purge-feedback", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    vi.stubEnv("VERCEL_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    admin.lt.mockReset();
    admin.lt.mockResolvedValue({ error: null, count: 3 });
    admin.getSupabaseAdmin.mockClear();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("deletes rows older than 12 months", async () => {
    const now = new Date("2026-10-20T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const res = await GET(authed());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 3 });
    expect(admin.lt).toHaveBeenCalledWith("created_at", feedbackPurgeCutoff(now));
    expect(feedbackPurgeCutoff(now)).toBe("2025-10-20T00:00:00.000Z");
    vi.useRealTimers();
  });

  it("logs the deleted count only", async () => {
    const res = await GET(authed());
    expect(res.status).toBe(200);
    expect(JSON.parse(String(vi.mocked(console.info).mock.calls[0]?.[0]))).toEqual({
      event: "feedback_purge",
      deleted: 3,
    });
    const logged = JSON.stringify([
      ...vi.mocked(console.info).mock.calls,
      ...vi.mocked(console.warn).mock.calls,
    ]);
    expect(logged).not.toContain("cron-test-secret");
    expect(logged).not.toContain("lvrasvtilgzwtfsfjbzd");
  });

  it("returns 200 when the table is missing", async () => {
    admin.lt.mockResolvedValue({
      error: {
        code: "42P01",
        message: 'relation "public.report_feedback" does not exist',
      },
      count: null,
    });
    const res = await GET(authed());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: 0 });
  });

  it("returns 503 without a secret and 401 for a bad secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(authed("nope"))).status).toBe(503);

    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    const denied = await GET(authed("wrong-secret-value"));
    expect(denied.status).toBe(401);
    expect(admin.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(vi.mocked(console.info)).not.toHaveBeenCalled();
    expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
  });

  it("refuses the prod database outside production", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://lvrasvtilgzwtfsfjbzd.supabase.co",
    );
    vi.stubEnv("VERCEL_ENV", "preview");
    const res = await GET(authed());
    expect(res.status).toBe(503);
    expect(admin.lt).not.toHaveBeenCalled();
    expect(JSON.parse(String(vi.mocked(console.warn).mock.calls[0]?.[0]))).toEqual({
      event: "feedback_purge_failed",
      code: "refusing_prod_db",
    });
  });
});
